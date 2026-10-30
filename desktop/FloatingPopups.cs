using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Speech.Synthesis;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace QuizGenie
{
    // =========================================================================
    // 1. مراقب ومحدد النصوص الشامل عبر كافة تطبيقات الويندوز
    // =========================================================================
    public class GlobalSelectionMonitor : IDisposable
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vk);

        [DllImport("user32.dll")]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        private const int WH_MOUSE_LL = 14;
        private const int WM_LBUTTONDOWN = 0x0201;
        private const int WM_LBUTTONUP = 0x0202;
        private const int WM_RBUTTONDOWN = 0x0204;
        private const byte VK_CONTROL = 0x11;
        private const byte VK_C = 0x43;
        private const uint KEYEVENTF_KEYUP = 0x0002;

        public const int HOTKEY_ID = 9119;
        public const int HOTKEY_SNIP_ID = 9120;
        public const int HOTKEY_F2_ID = 9121;
        public const int MOD_CONTROL = 0x0002;
        public const int MOD_ALT = 0x0001;
        public const int MOD_SHIFT = 0x0004;

        private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

        private LowLevelMouseProc mouseProc;
        private IntPtr hookId = IntPtr.Zero;
        private Form hostForm;
        private Point downPoint;
        private int downTick;
        private System.Windows.Forms.Timer selectionCheckTimer;
        private bool isDisposed = false;

        private bool _isEnabled = true;
        public bool IsEnabled { get { return _isEnabled; } set { _isEnabled = value; } }
        public event Action<string, Point> TextSelected;
        public event Action ClickedOutside;

        public GlobalSelectionMonitor(Form host)
        {
            this.hostForm = host;
            mouseProc = MouseHookCallback;

            try
            {
                using (var curProcess = System.Diagnostics.Process.GetCurrentProcess())
                using (var curModule = curProcess.MainModule)
                {
                    hookId = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, GetModuleHandle(curModule.ModuleName), 0);
                }
            }
            catch { }

            // تسجيل الاختصار السريع Ctrl+Q لحل أي نص محدد فوراً
            try { RegisterHotKey(hostForm.Handle, HOTKEY_ID, MOD_CONTROL, (int)Keys.Q); } catch { }
            // تسجيل اختصار تصوير الشاشة وحلها فوراً Ctrl+Shift+S و F2
            try { RegisterHotKey(hostForm.Handle, HOTKEY_SNIP_ID, MOD_CONTROL | MOD_SHIFT, (int)Keys.S); } catch { }
            try { RegisterHotKey(hostForm.Handle, HOTKEY_F2_ID, 0, (int)Keys.F2); } catch { }

            selectionCheckTimer = new System.Windows.Forms.Timer { Interval = 75 };
            selectionCheckTimer.Tick += OnSelectionCheckTimerTick;
        }

        private IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && IsEnabled)
            {
                int msg = wParam.ToInt32();
                if (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN)
                {
                    downPoint = Cursor.Position;
                    downTick = Environment.TickCount;

                    if (ClickedOutside != null && hostForm != null && !hostForm.IsDisposed)
                    {
                        try { hostForm.BeginInvoke(ClickedOutside); } catch { }
                    }
                }
                else if (msg == WM_LBUTTONUP)
                {
                    Point upPoint = Cursor.Position;
                    int dx = Math.Abs(upPoint.X - downPoint.X);
                    int dy = Math.Abs(upPoint.Y - downPoint.Y);
                    int dt = Environment.TickCount - downTick;

                    // تم التحديد بالسحب (Drag) أو بالنقر المزدوج (Double-Click)
                    if ((dx > 7 || dy > 7) || (dt < 400 && dx < 4 && dy < 4))
                    {
                        if (hostForm != null && !hostForm.IsDisposed)
                        {
                            try
                            {
                                hostForm.BeginInvoke((Action)(() => {
                                    selectionCheckTimer.Stop();
                                    selectionCheckTimer.Start();
                                }));
                            }
                            catch { }
                        }
                    }
                }
            }
            return CallNextHookEx(hookId, nCode, wParam, lParam);
        }

        private void OnSelectionCheckTimerTick(object sender, EventArgs e)
        {
            selectionCheckTimer.Stop();
            if (!IsEnabled || hostForm == null || hostForm.IsDisposed) return;

            // التأكد من أن المستخدم ليس داخل نوافذ QuizGenie نفسها
            IntPtr fgHwnd = GetForegroundWindow();
            if (fgHwnd != IntPtr.Zero)
            {
                uint fgPid;
                GetWindowThreadProcessId(fgHwnd, out fgPid);
                uint myPid = (uint)System.Diagnostics.Process.GetCurrentProcess().Id;
                if (fgPid == myPid)
                {
                    Point cur = Cursor.Position;
                    if (hostForm.Bounds.Contains(cur)) return;
                }
            }

            TriggerCaptureAndNotify(Cursor.Position);
        }

        public void TriggerCaptureAndNotify(Point cursorPt)
        {
            // حفظ الحافظة السابقة
            string previousClipboard = null;
            try
            {
                if (Clipboard.ContainsText())
                    previousClipboard = Clipboard.GetText();
            }
            catch { }

            try { Clipboard.Clear(); } catch { }

            // محاكاة نسخ النص المحدد Ctrl+C
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_C, 0, 0, 0);
            keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);

            var readTimer = new System.Windows.Forms.Timer { Interval = 45 };
            readTimer.Tick += (s, ev) => {
                readTimer.Stop();
                readTimer.Dispose();

                string captured = "";
                try
                {
                    if (Clipboard.ContainsText())
                        captured = Clipboard.GetText();
                }
                catch { }

                if (!string.IsNullOrWhiteSpace(captured) && captured.Trim().Length >= 2)
                {
                    // تم التقاط نص محدد بنجاح!
                    string cleanText = captured.Trim();
                    if (TextSelected != null && hostForm != null && !hostForm.IsDisposed)
                    {
                        try { hostForm.BeginInvoke(TextSelected, cleanText, cursorPt); } catch { }
                    }
                }
                else
                {
                    // لم يتم تحديد أي نص - استعادة الحافظة الأصلية بهدوء
                    try
                    {
                        if (previousClipboard != null)
                            Clipboard.SetText(previousClipboard);
                    }
                    catch { }
                }
            };
            readTimer.Start();
        }

        public void Dispose()
        {
            if (isDisposed) return;
            isDisposed = true;

            try
            {
                if (hookId != IntPtr.Zero)
                {
                    UnhookWindowsHookEx(hookId);
                    hookId = IntPtr.Zero;
                }
            }
            catch { }

            try
            {
                if (hostForm != null && hostForm.Handle != IntPtr.Zero)
                {
                    UnregisterHotKey(hostForm.Handle, HOTKEY_ID);
                    UnregisterHotKey(hostForm.Handle, HOTKEY_SNIP_ID);
                    UnregisterHotKey(hostForm.Handle, HOTKEY_F2_ID);
                }
            }
            catch { }

            if (selectionCheckTimer != null)
            {
                selectionCheckTimer.Stop();
                selectionCheckTimer.Dispose();
            }
        }
    }

    // =========================================================================
    // 2. زر الحل العائم المطابق لإضافة كروم (FAB)
    // =========================================================================
    public class FloatingFabForm : Form
    {
        private MainForm mainForm;
        private string currentCapturedText = "";
        private bool isHovered = false;
        private Image logoImage;

        public string CapturedText { get { return currentCapturedText; } }

        public FloatingFabForm(MainForm parent)
        {
            this.mainForm = parent;
            this.FormBorderStyle = FormBorderStyle.None;
            this.ShowInTaskbar = false;
            this.TopMost = true;
            this.Size = new Size(42, 42);
            this.StartPosition = FormStartPosition.Manual;
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.Cursor = Cursors.Hand;
            this.DoubleBuffered = true;

            UITheme.ApplyRoundCorners(this, 11);

            // تحميل شعار QuizGenie
            try
            {
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icons", "icon48.png");
                if (File.Exists(iconPath))
                {
                    logoImage = Image.FromFile(iconPath);
                }
                else
                {
                    string rootIcon = Path.Combine(@"C:\QuizGenie\icons", "icon48.png");
                    if (File.Exists(rootIcon)) logoImage = Image.FromFile(rootIcon);
                }
            }
            catch { }

            this.MouseEnter += (s, e) => { isHovered = true; this.Invalidate(); };
            this.MouseLeave += (s, e) => { isHovered = false; this.Invalidate(); };
            this.Click += (s, e) => ShowMiniMenu();
        }

        public void SetCapturedText(string text)
        {
            currentCapturedText = text;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            Color bg = isHovered ? Color.FromArgb(30, 41, 59) : Color.FromArgb(15, 23, 42);
            Color border = isHovered ? Color.FromArgb(2, 132, 199) : Color.FromArgb(51, 65, 85);

            using (Brush b = new SolidBrush(bg))
            {
                g.FillRectangle(b, 0, 0, Width, Height);
            }

            if (logoImage != null)
            {
                int imgW = 24;
                int imgH = 24;
                int ix = (Width - imgW) / 2;
                int iy = (Height - imgH) / 2;
                g.DrawImage(logoImage, new Rectangle(ix, iy, imgW, imgH));
            }
            else
            {
                using (Font f = new Font("Segoe UI", 14f, FontStyle.Bold))
                using (Brush b = new SolidBrush(Color.FromArgb(56, 189, 248)))
                {
                    g.DrawString("⚡", f, b, 7, 7);
                }
            }

            using (Pen pen = new Pen(border, 1.5f))
            using (GraphicsPath path = UITheme.CreateRoundedPath(new Rectangle(0, 0, Width - 1, Height - 1), 11))
            {
                g.DrawPath(pen, path);
            }
        }

        private void ShowMiniMenu()
        {
            mainForm.OpenFloatingMenu(this.Location, currentCapturedText);
            this.Hide();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x08000000; // WS_EX_NOACTIVATE (لا يسحب التركيز من التطبيق الأصلي)
                cp.ClassStyle |= 0x00020000; // CS_DROPSHADOW
                return cp;
            }
        }
    }

    // =========================================================================
    // 3. القائمة المصغرة للخيارات السريعة (Mini-Menu)
    // =========================================================================
    public class FloatingMenuForm : Form
    {
        private MainForm mainForm;
        private string capturedText;

        public FloatingMenuForm(MainForm parent)
        {
            this.mainForm = parent;
            this.FormBorderStyle = FormBorderStyle.None;
            this.ShowInTaskbar = false;
            this.TopMost = true;
            this.Size = new Size(240, 178);
            this.StartPosition = FormStartPosition.Manual;
            this.BackColor = Color.FromArgb(11, 15, 25);
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            UITheme.ApplyRoundedCard(this, 12, Color.FromArgb(56, 189, 248), 1.2f);

            // Header
            Panel pnlHdr = new Panel { Location = new Point(0, 0), Size = new Size(240, 30), BackColor = Color.FromArgb(15, 23, 42) };
            Label lblTitle = new Label
            {
                Text = "⚡ QuizGenie - مساعد الحل الفوري",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(8, 6),
                AutoSize = true
            };
            pnlHdr.Controls.Add(lblTitle);
            this.Controls.Add(pnlHdr);

            // Button 1: حل مباشر
            Button btnConcise = CreateMenuButton("🎯 حل مباشر (موجز وسريع)", 34, Color.FromArgb(2, 132, 199));
            btnConcise.Click += (s, e) => {
                this.Hide();
                mainForm.OpenFloatingAnswer(this.Location, capturedText, "concise");
            };

            // Button 2: حل تفصيلي
            Button btnDetailed = CreateMenuButton("📝 حل تفصيلي وشرح كامل", 68, Color.FromArgb(139, 92, 246));
            btnDetailed.Click += (s, e) => {
                this.Hide();
                mainForm.OpenFloatingAnswer(this.Location, capturedText, "detailed");
            };

            // Button 3: قص وحل من الشاشة
            Button btnSnip = CreateMenuButton("📸 قص منطقة من الشاشة (F2)", 102, Color.FromArgb(16, 185, 129));
            btnSnip.Click += (s, e) => {
                this.Hide();
                mainForm.StartScreenSnip();
            };

            // Button 4: نسخ السؤال
            Button btnCopy = CreateMenuButton("📋 نسخ النص إلى الحافظة", 136, Color.FromArgb(51, 65, 85));
            btnCopy.Click += (s, e) => {
                try { Clipboard.SetText(capturedText); } catch { }
                this.Hide();
            };

            this.Controls.Add(btnConcise);
            this.Controls.Add(btnDetailed);
            this.Controls.Add(btnSnip);
            this.Controls.Add(btnCopy);
        }

        public void SetText(string text)
        {
            this.capturedText = text;
        }

        private Button CreateMenuButton(string text, int y, Color hoverBorder)
        {
            Button btn = new Button
            {
                Text = text,
                Location = new Point(6, y),
                Size = new Size(228, 30),
                BackColor = Color.FromArgb(17, 24, 39),
                ForeColor = Color.FromArgb(241, 245, 249),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand,
                TextAlign = ContentAlignment.MiddleRight
            };
            btn.FlatAppearance.BorderSize = 1;
            btn.FlatAppearance.BorderColor = Color.FromArgb(30, 41, 59);

            btn.MouseEnter += (s, e) => {
                btn.BackColor = Color.FromArgb(30, 41, 59);
                btn.FlatAppearance.BorderColor = hoverBorder;
                btn.ForeColor = Color.FromArgb(56, 189, 248);
            };
            btn.MouseLeave += (s, e) => {
                btn.BackColor = Color.FromArgb(17, 24, 39);
                btn.FlatAppearance.BorderColor = Color.FromArgb(30, 41, 59);
                btn.ForeColor = Color.FromArgb(241, 245, 249);
            };
            return btn;
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ClassStyle |= 0x00020000; // CS_DROPSHADOW
                return cp;
            }
        }
    }

    // =========================================================================
    // 4. بطاقة عرض الإجابة والحل العائمة (Floating Answer Card)
    // =========================================================================
    public class FloatingAnswerForm : Form
    {
        public void SetPrecomputedAnswer(string q, string ans, string mode)
        {
            if (this.questionText == q)
            {
                if (mode == "concise") cachedConciseResult = ans;
                if (mode == "detailed") cachedDetailedResult = ans;
                if (this.activeMode == mode && !string.IsNullOrEmpty(ans))
                {
                    try
                    {
                        if (this.InvokeRequired)
                        {
                            this.BeginInvoke((Action)(() => {
                                txtSolution.Text = ans;
                                lblStatus.Text = "✨ تم الحل فوراً من الذاكرة الاستباقية (0.0 ثانية)";
                            }));
                        }
                        else
                        {
                            txtSolution.Text = ans;
                            lblStatus.Text = "✨ تم الحل فوراً من الذاكرة الاستباقية (0.0 ثانية)";
                        }
                    }
                    catch { }
                }
            }
        }
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

        private MainForm mainForm;
        private string questionText;
        private string activeMode = "concise";

        private string cachedConciseResult = null;
        private string cachedDetailedResult = null;
        private string lastCachedQuestion = "";
        private float currentFontSize = 10.5f;

        private SpeechSynthesizer speechSynth;
        private bool isSpeaking = false;
        private Button btnSpeak;

        private Bitmap capturedImage = null;
        private string cachedImageConciseResult = null;
        private string cachedImageDetailedResult = null;
        private bool isImageMode = false;

        private Label lblHeaderServer;
        private Button btnTabConcise;
        private Button btnTabDetailed;
        private TextBox txtSolution;
        private Button btnCopy;
        private Label lblStatus;

        public FloatingAnswerForm(MainForm parent)
        {
            this.mainForm = parent;
            this.FormBorderStyle = FormBorderStyle.None;
            this.ShowInTaskbar = false;
            this.TopMost = true;
            this.Size = new Size(540, 430);
            this.StartPosition = FormStartPosition.Manual;
            this.BackColor = Color.FromArgb(11, 15, 25);
            this.ForeColor = Color.White;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            UITheme.ApplyRoundedCard(this, 14, Color.FromArgb(56, 189, 248), 1.5f);

            BuildUI();

            this.KeyPreview = true;
            this.KeyDown += (s, e) => {
                if (e.KeyCode == Keys.Escape) this.Hide();
                if (e.KeyCode == Keys.D1 || e.KeyCode == Keys.NumPad1) SwitchMode("concise");
                if (e.KeyCode == Keys.D2 || e.KeyCode == Keys.NumPad2) SwitchMode("detailed");
            };
        }

        private void BuildUI()
        {
            // 1. شريط العنوان قابل للسحب
            Panel pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 44,
                BackColor = Color.FromArgb(15, 23, 42)
            };
            pnlHeader.MouseDown += (s, e) => {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(Handle, 0xA1, 0x2, 0);
                }
            };

            Label lblLogo = new Label
            {
                Text = "⚡ QuizGenie AI",
                Location = new Point(12, 10),
                AutoSize = true,
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248)
            };
            lblLogo.MouseDown += (s, e) => {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(Handle, 0xA1, 0x2, 0);
                }
            };

            lblHeaderServer = new Label
            {
                Text = "⚡ Gemini 3.5",
                Location = new Point(136, 11),
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(52, 211, 153),
                BackColor = Color.FromArgb(20, 45, 35),
                Padding = new Padding(6, 2, 6, 2)
            };
            UITheme.ApplyRoundCorners(lblHeaderServer, 6);

            btnSpeak = new Button
            {
                Text = "🔊 استماع",
                Location = new Point(232, 8),
                Size = new Size(74, 28),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(203, 213, 225),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnSpeak.FlatAppearance.BorderSize = 0;
            btnSpeak.Click += (s, e) => ToggleSpeech();

            Button btnZoomOut = new Button
            {
                Text = "A-",
                Location = new Point(310, 8),
                Size = new Size(32, 28),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(203, 213, 225),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnZoomOut.FlatAppearance.BorderSize = 0;
            btnZoomOut.Click += (s, e) => {
                if (currentFontSize > 8.5f) {
                    currentFontSize -= 1.0f;
                    txtSolution.Font = new Font("Segoe UI", currentFontSize);
                }
            };

            Button btnZoomIn = new Button
            {
                Text = "A+",
                Location = new Point(346, 8),
                Size = new Size(32, 28),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(203, 213, 225),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnZoomIn.FlatAppearance.BorderSize = 0;
            btnZoomIn.Click += (s, e) => {
                if (currentFontSize < 16.0f) {
                    currentFontSize += 1.0f;
                    txtSolution.Font = new Font("Segoe UI", currentFontSize);
                }
            };

            btnCopy = new Button
            {
                Text = "📋 نسخ",
                Location = new Point(382, 8),
                Size = new Size(74, 28),
                BackColor = Color.FromArgb(2, 132, 199),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnCopy.FlatAppearance.BorderSize = 0;
            btnCopy.Click += (s, e) => {
                if (!string.IsNullOrEmpty(txtSolution.Text))
                {
                    Clipboard.SetText(txtSolution.Text);
                    btnCopy.Text = "تم ✓";
                    btnCopy.BackColor = Color.FromArgb(16, 185, 129);
                    var t = new System.Windows.Forms.Timer { Interval = 1600 };
                    t.Tick += (s2, ev) => {
                        t.Stop();
                        t.Dispose();
                        btnCopy.Text = "📋 نسخ";
                        btnCopy.BackColor = Color.FromArgb(2, 132, 199);
                    };
                    t.Start();
                }
            };

            Button btnClose = new Button
            {
                Text = "✕",
                Location = new Point(495, 8),
                Size = new Size(28, 28),
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(148, 163, 184),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.Click += (s, e) => {
                StopSpeech();
                this.Hide();
            };

            pnlHeader.Controls.Add(lblLogo);
            pnlHeader.Controls.Add(lblHeaderServer);
            pnlHeader.Controls.Add(btnSpeak);
            pnlHeader.Controls.Add(btnZoomOut);
            pnlHeader.Controls.Add(btnZoomIn);
            pnlHeader.Controls.Add(btnCopy);
            pnlHeader.Controls.Add(btnClose);

            // 2. شريط الأوضاع المستقلة (حل مباشر حاسم / شرح أكاديمي وتفنيد)
            Panel pnlTabs = new Panel
            {
                Dock = DockStyle.Top,
                Height = 38,
                BackColor = Color.FromArgb(17, 24, 39)
            };

            btnTabConcise = new Button
            {
                Text = "⚡ حل مباشر (بدون فلسفة)",
                Location = new Point(12, 4),
                Size = new Size(185, 30),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnTabConcise.FlatAppearance.BorderSize = 0;
            btnTabConcise.Click += (s, e) => SwitchMode("concise");

            btnTabDetailed = new Button
            {
                Text = "📖 شرح مفصل وتفنيد الخيارات",
                Location = new Point(205, 4),
                Size = new Size(205, 30),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnTabDetailed.FlatAppearance.BorderSize = 0;
            btnTabDetailed.Click += (s, e) => SwitchMode("detailed");

            pnlTabs.Controls.Add(btnTabConcise);
            pnlTabs.Controls.Add(btnTabDetailed);

            // 3. شريط الحالة السفلي
            Panel pnlFooter = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 30,
                BackColor = Color.FromArgb(15, 23, 42)
            };

            lblStatus = new Label
            {
                Text = "💡 اضغط 1 للحل المباشر | اضغط 2 للشرح المفصل | Esc للإغلاق",
                Location = new Point(12, 7),
                AutoSize = true,
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(148, 163, 184)
            };
            pnlFooter.Controls.Add(lblStatus);

            // 4. منطقة عرض الحل
            txtSolution = new TextBox
            {
                Dock = DockStyle.Fill,
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                BackColor = Color.FromArgb(11, 15, 25),
                ForeColor = Color.FromArgb(248, 250, 252),
                Font = new Font("Segoe UI", currentFontSize),
                BorderStyle = BorderStyle.None,
                RightToLeft = RightToLeft.Yes
            };

            this.Controls.Add(txtSolution);
            this.Controls.Add(pnlFooter);
            this.Controls.Add(pnlTabs);
            this.Controls.Add(pnlHeader);
        }

        public void SolveQuestion(string text, string mode)
        {
            isImageMode = false;
            capturedImage = null;
            this.questionText = text;
            this.activeMode = mode;
            StopSpeech();

            lblHeaderServer.Text = mainForm.GetActiveServerDisplayName();
            UpdateTabStyles();

            // Clear cache if new question arrives
            if (questionText != lastCachedQuestion)
            {
                cachedConciseResult = null;
                cachedDetailedResult = null;
                lastCachedQuestion = questionText;
            }
            if (MainForm.speculativeCachedQuestion == questionText && !string.IsNullOrEmpty(MainForm.speculativeConciseAnswer))
            {
                cachedConciseResult = MainForm.speculativeConciseAnswer;
            }

            // Return cached result if already fetched
            if (activeMode == "concise" && !string.IsNullOrEmpty(cachedConciseResult))
            {
                txtSolution.Text = cachedConciseResult;
                lblStatus.Text = "⚡ تم عرض الحل المباشر الحاسم فوراً | اضغط 2 للشرح المفصل";
                return;
            }
            if (activeMode == "detailed" && !string.IsNullOrEmpty(cachedDetailedResult))
            {
                txtSolution.Text = cachedDetailedResult;
                lblStatus.Text = "📖 تم عرض الشرح الأكاديمي المفصل وتفنيد الخيارات فوراً";
                return;
            }

            if (activeMode == "concise")
            {
                txtSolution.Text = "⚡ [عقلية الحل المباشر الحاسم]\nجارٍ استخلاص رمز ونص الخيار الصحيح بتركيز 100% بدون أي فلسفة أو استرسال...\n\nالسؤال الملتقط:\n" + questionText;
                lblStatus.Text = "⏳ جارٍ التحليل والاستنتاج السريع...";
            }
            else
            {
                txtSolution.Text = "📖 [عقلية الأستاذ الأكاديمي والشرح المفصل]\nجارٍ تفكيك خطوات المسألة، صياغة القواعد العلمية، وتفنيد باقي الخيارات...\n\nالسؤال الملتقط:\n" + questionText;
                lblStatus.Text = "⏳ جارٍ إعداد الشرح الأكاديمي المتسلسل وتفنيد الخيارات...";
            }

            Task.Factory.StartNew(async () => {
                string result = "";
                try
                {
                    result = await mainForm.SolveTextDirectAsync(questionText, activeMode);
                }
                catch (Exception ex)
                {
                    result = "❌ تعذر إتمام الحل: " + ex.Message + "\n\n💡 نصيحة: تأكد من اتصال الإنترنت أو مفتاح Gemini.";
                }

                if (!this.IsDisposed)
                {
                    this.BeginInvoke((Action)(() => {
                        if (activeMode == "concise")
                        {
                            cachedConciseResult = result;
                            lblStatus.Text = "⚡ اكتمل الحل المباشر بنجاح | انقر على (شرح وتفنيد) للتعمق";
                        }
                        else
                        {
                            cachedDetailedResult = result;
                            lblStatus.Text = "📖 اكتمل الشرح الأكاديمي وتفنيد الخيارات بنجاح";
                        }
                        txtSolution.Text = result;
                    }));
                }
            });
        }

        public void SolveImage(Bitmap bmp, string mode)
        {
            isImageMode = true;
            this.capturedImage = bmp;
            this.activeMode = mode;
            this.questionText = "[سؤال ملتقط من الشاشة]";
            StopSpeech();

            lblHeaderServer.Text = mainForm.GetActiveServerDisplayName();
            UpdateTabStyles();

            if (activeMode == "concise" && !string.IsNullOrEmpty(cachedImageConciseResult))
            {
                txtSolution.Text = cachedImageConciseResult;
                lblStatus.Text = "⚡ تم عرض الحل المباشر للصورة فوراً | اضغط 2 للشرح";
                return;
            }
            if (activeMode == "detailed" && !string.IsNullOrEmpty(cachedImageDetailedResult))
            {
                txtSolution.Text = cachedImageDetailedResult;
                lblStatus.Text = "📖 تم عرض الشرح الأكاديمي للصورة وتفنيد الخيارات فوراً";
                return;
            }

            if (activeMode == "concise")
            {
                txtSolution.Text = "📸 [تحليل لقطة الشاشة بالذكاء الاصطناعي - Gemini Vision]\n⚡ جارٍ قراءة السؤال من الصورة، وحل المسألة مباشرة بدون فلسفة...\n\n(يتم إرسال الصورة مباشرة لموديل Gemini Vision 3.5)";
                lblStatus.Text = "⏳ جارٍ مسح الصورة واستخراج الإجابة الحاصمة...";
            }
            else
            {
                txtSolution.Text = "📸 [تحليل لقطة الشاشة بالذكاء الاصطناعي - Gemini Vision]\n📖 جارٍ قراءة السؤال والمعادلات من الصورة، وبناء الشرح وتفنيد باقي الخيارات...\n\n(يتم إرسال الصورة مباشرة لموديل Gemini Vision 3.5)";
                lblStatus.Text = "⏳ جارٍ قراءة الصورة وإعداد الشرح الأكاديمي المتسلسل...";
            }

            Task.Factory.StartNew(async () => {
                string result = "";
                try
                {
                    result = await mainForm.SolveImageDirectAsync(bmp, activeMode);
                }
                catch (Exception ex)
                {
                    result = "❌ تعذر تحليل السؤال المصور: " + ex.Message + "\n\n💡 نصيحة: تأكد من وضوح لقطة الشاشة أو مفتاح Gemini.";
                }

                if (!this.IsDisposed)
                {
                    this.BeginInvoke((Action)(() => {
                        if (activeMode == "concise")
                        {
                            cachedImageConciseResult = result;
                            lblStatus.Text = "⚡ اكتمل حل السؤال المصور بنجاح | انقر على (شرح وتفنيد) للتعمق";
                        }
                        else
                        {
                            cachedImageDetailedResult = result;
                            lblStatus.Text = "📖 اكتمل الشرح الأكاديمي للصورة وتفنيد الخيارات بنجاح";
                        }
                        txtSolution.Text = result;
                    }));
                }
            });
        }

        private void SwitchMode(string mode)
        {
            if (activeMode == mode) return;
            if (isImageMode && capturedImage != null)
            {
                SolveImage(capturedImage, mode);
            }
            else
            {
                SolveQuestion(questionText, mode);
            }
        }

        private void StopSpeech()
        {
            if (isSpeaking && speechSynth != null)
            {
                try { speechSynth.SpeakAsyncCancelAll(); } catch { }
                isSpeaking = false;
                btnSpeak.Text = "🔊 استماع";
                btnSpeak.BackColor = Color.FromArgb(30, 41, 59);
            }
        }

        private void ToggleSpeech()
        {
            if (isSpeaking)
            {
                StopSpeech();
            }
            else
            {
                string textToRead = txtSolution.Text;
                if (string.IsNullOrWhiteSpace(textToRead)) return;

                textToRead = textToRead.Replace("🎯", "").Replace("⚡", "").Replace("📘", "")
                                       .Replace("📐", "").Replace("🔍", "").Replace("💡", "")
                                       .Replace("✓", "").Replace("❌", "").Replace("*", "").Replace("#", "");

                try
                {
                    if (speechSynth == null)
                    {
                        speechSynth = new SpeechSynthesizer();
                        speechSynth.SpeakCompleted += (s, e) => {
                            isSpeaking = false;
                            if (!this.IsDisposed)
                            {
                                this.BeginInvoke((Action)(() => {
                                    btnSpeak.Text = "🔊 استماع";
                                    btnSpeak.BackColor = Color.FromArgb(30, 41, 59);
                                }));
                            }
                        };
                    }
                    speechSynth.SpeakAsyncCancelAll();
                    speechSynth.SpeakAsync(textToRead);
                    isSpeaking = true;
                    btnSpeak.Text = "⏹️ إيقاف";
                    btnSpeak.BackColor = Color.FromArgb(239, 68, 68);
                }
                catch (Exception ex)
                {
                    MessageBox.Show("تعذر تشغيل الصوت: " + ex.Message, "QuizGenie Audio", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
        }

        private void UpdateTabStyles()
        {
            if (activeMode == "concise")
            {
                btnTabConcise.BackColor = Color.FromArgb(2, 132, 199);
                btnTabConcise.ForeColor = Color.White;

                btnTabDetailed.BackColor = Color.FromArgb(30, 41, 59);
                btnTabDetailed.ForeColor = Color.FromArgb(148, 163, 184);
            }
            else
            {
                btnTabDetailed.BackColor = Color.FromArgb(139, 92, 246);
                btnTabDetailed.ForeColor = Color.White;

                btnTabConcise.BackColor = Color.FromArgb(30, 41, 59);
                btnTabConcise.ForeColor = Color.FromArgb(148, 163, 184);
            }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ClassStyle |= 0x00020000; // CS_DROPSHADOW
                return cp;
            }
        }
    }

    // =========================================================================
    // 5. نافذة التقاط وقص منطقة من الشاشة وحلها (Screen Snipping & Solving)
    // =========================================================================
    public class ScreenSnipOverlayForm : Form
    {
        private MainForm mainForm;
        private Point startPoint;
        private Point currentPoint;
        private bool isSelecting = false;

        public ScreenSnipOverlayForm(MainForm parent)
        {
            this.mainForm = parent;
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.Manual;
            this.Location = SystemInformation.VirtualScreen.Location;
            this.Size = SystemInformation.VirtualScreen.Size;
            this.TopMost = true;
            this.ShowInTaskbar = false;
            this.Cursor = Cursors.Cross;
            this.DoubleBuffered = true;
            this.BackColor = Color.Black;
            this.Opacity = 0.50;

            this.KeyPreview = true;
            this.KeyDown += (s, e) => {
                if (e.KeyCode == Keys.Escape)
                {
                    this.Close();
                    this.Dispose();
                }
            };

            this.MouseDown += (s, e) => {
                if (e.Button == MouseButtons.Left)
                {
                    isSelecting = true;
                    startPoint = Cursor.Position;
                    currentPoint = Cursor.Position;
                    this.Invalidate();
                }
            };

            this.MouseMove += (s, e) => {
                if (isSelecting)
                {
                    currentPoint = Cursor.Position;
                    this.Invalidate();
                }
            };

            this.MouseUp += (s, e) => {
                if (isSelecting && e.Button == MouseButtons.Left)
                {
                    isSelecting = false;
                    Rectangle rect = GetSelectionRectangle();

                    // Hide overlay first so screenshot doesn't capture the overlay tint
                    this.Visible = false;
                    Application.DoEvents();
                    System.Threading.Thread.Sleep(60);

                    if (rect.Width > 15 && rect.Height > 15)
                    {
                        try
                        {
                            Bitmap bmp = new Bitmap(rect.Width, rect.Height);
                            using (Graphics g = Graphics.FromImage(bmp))
                            {
                                g.CopyFromScreen(rect.Location, Point.Empty, rect.Size);
                            }

                            mainForm.OpenFloatingAnswerWithImage(new Point(rect.Right + 10, rect.Top), bmp, "concise");
                        }
                        catch (Exception ex)
                        {
                            MessageBox.Show("تعذر التقاط منطقة الشاشة: " + ex.Message, "QuizGenie", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                        }
                    }

                    this.Close();
                    this.Dispose();
                }
            };
        }

        private Rectangle GetSelectionRectangle()
        {
            int x = Math.Min(startPoint.X, currentPoint.X);
            int y = Math.Min(startPoint.Y, currentPoint.Y);
            int w = Math.Abs(startPoint.X - currentPoint.X);
            int h = Math.Abs(startPoint.Y - currentPoint.Y);
            return new Rectangle(x, y, w, h);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            // Draw top instruction banner
            using (Brush b = new SolidBrush(Color.FromArgb(220, 15, 23, 42)))
            {
                g.FillRectangle(b, 0, 0, Width, 46);
            }
            using (Font f = new Font("Segoe UI", 12f, FontStyle.Bold))
            using (Brush fb = new SolidBrush(Color.FromArgb(56, 189, 248)))
            {
                string guide = "📸 اسحب مؤشر الفأرة لتحديد منطقة السؤال على الشاشة (سؤال محمي / صورة / معادلة) | اضغط Esc للإلغاء";
                var size = g.MeasureString(guide, f);
                g.DrawString(guide, f, fb, (Width - size.Width) / 2, 11);
            }

            if (isSelecting)
            {
                Rectangle rect = GetSelectionRectangle();
                Rectangle localRect = new Rectangle(rect.X - this.Left, rect.Y - this.Top, rect.Width, rect.Height);

                using (Pen pen = new Pen(Color.FromArgb(239, 68, 68), 2.5f))
                {
                    pen.DashStyle = DashStyle.Solid;
                    g.DrawRectangle(pen, localRect);
                }
                using (Font bf = new Font("Segoe UI", 9f, FontStyle.Bold))
                using (Brush bbg = new SolidBrush(Color.FromArgb(220, 220, 38, 38)))
                using (Brush btext = new SolidBrush(Color.White))
                {
                    string badge = "📌 منطقة السؤال والخيارات";
                    var bsize = g.MeasureString(badge, bf);
                    int bx = localRect.Right - (int)bsize.Width - 10;
                    int by = localRect.Top - (int)bsize.Height - 6;
                    if (by < 48) by = localRect.Top + 4;
                    if (bx < localRect.Left) bx = localRect.Left + 4;
                    g.FillRectangle(bbg, bx, by, bsize.Width + 8, bsize.Height + 4);
                    g.DrawString(badge, bf, btext, bx + 4, by + 2);
                }

                using (Brush b = new SolidBrush(Color.FromArgb(45, 56, 189, 248)))
                {
                    g.FillRectangle(b, localRect);
                }
            }
        }
    }

    // =========================================================================
    // 6. محدد الشاشة للحل المباشر المستمر بنمط سكرين شوت ويندوز (Win+Shift+S)
    // =========================================================================
    public class LiveDirectDesktopSelectorForm : Form
    {
        private MainForm mainForm;
        private Point startPoint;
        private Point currentPoint;
        private bool isSelecting = false;
        private Bitmap screenSnapshot;

        public LiveDirectDesktopSelectorForm(MainForm parent)
        {
            this.mainForm = parent;
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.Manual;
            this.Location = SystemInformation.VirtualScreen.Location;
            this.Size = SystemInformation.VirtualScreen.Size;
            this.TopMost = true;
            this.ShowInTaskbar = false;
            this.Cursor = Cursors.Cross;
            this.DoubleBuffered = true;

            // التقاط لقطة فورية كاملة للشاشة قبل التعتيم لجعل منطقة التحديد واضحة 100% مثل سكرين شوت ويندوز
            try
            {
                screenSnapshot = new Bitmap(Width, Height);
                using (Graphics g = Graphics.FromImage(screenSnapshot))
                {
                    g.CopyFromScreen(Location, Point.Empty, Size);
                }
            }
            catch { }

            // شريط ويندوز 11 العائم بالأعلى (Snipping Pill)
            Panel pnlBar = new Panel
            {
                Size = new Size(520, 48),
                Location = new Point((Width - 520) / 2, 20),
                BackColor = Color.FromArgb(24, 24, 27),
                Cursor = Cursors.Default
            };
            UITheme.ApplyRoundedCard(pnlBar, 24, Color.FromArgb(56, 189, 248), 1.2f);

            Label lblTitle = new Label
            {
                Text = "📸 حدد السؤال مثل سكرين شوت ويندوز (Win+Shift+S):",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(190, 13),
                Size = new Size(315, 22),
                RightToLeft = RightToLeft.Yes
            };
            pnlBar.Controls.Add(lblTitle);

            Button btnFull = new Button
            {
                Text = "🖥️ كامل الشاشة",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(2, 132, 199),
                FlatStyle = FlatStyle.Flat,
                Location = new Point(80, 9),
                Size = new Size(100, 30),
                Cursor = Cursors.Hand
            };
            btnFull.FlatAppearance.BorderSize = 0;
            UITheme.ApplyRoundedCard(btnFull, 14, Color.Transparent);
            btnFull.Click += (s, e) => {
                this.Close();
                this.Dispose();
                if (screenSnapshot != null)
                {
                    mainForm.OpenFloatingAnswerWithImage(new Point(Screen.PrimaryScreen.WorkingArea.Right - 380, 40), (Bitmap)screenSnapshot.Clone(), "concise");
                }
                mainForm.LaunchLiveDirectHud(SystemInformation.VirtualScreen);
            };
            pnlBar.Controls.Add(btnFull);

            Button btnCancel = new Button
            {
                Text = "✕",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(203, 213, 225),
                BackColor = Color.FromArgb(51, 65, 85),
                FlatStyle = FlatStyle.Flat,
                Location = new Point(15, 9),
                Size = new Size(55, 30),
                Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderSize = 0;
            UITheme.ApplyRoundedCard(btnCancel, 14, Color.Transparent);
            btnCancel.Click += (s, e) => {
                this.Close();
                this.Dispose();
            };
            pnlBar.Controls.Add(btnCancel);

            this.Controls.Add(pnlBar);

            this.KeyPreview = true;
            this.KeyDown += (s, e) => {
                if (e.KeyCode == Keys.Escape)
                {
                    this.Close();
                    this.Dispose();
                }
            };

            this.MouseDown += (s, e) => {
                if (e.Button == MouseButtons.Left && !pnlBar.Bounds.Contains(e.Location))
                {
                    isSelecting = true;
                    startPoint = Cursor.Position;
                    currentPoint = Cursor.Position;
                    this.Invalidate();
                }
            };

            this.MouseMove += (s, e) => {
                if (isSelecting)
                {
                    currentPoint = Cursor.Position;
                    this.Invalidate();
                }
            };

            this.MouseUp += (s, e) => {
                if (isSelecting && e.Button == MouseButtons.Left)
                {
                    isSelecting = false;
                    Rectangle rect = GetSelectionRectangle();
                    this.Visible = false;
                    Application.DoEvents();

                    if (rect.Width > 20 && rect.Height > 20 && screenSnapshot != null)
                    {
                        try
                        {
                            Rectangle localRect = new Rectangle(rect.X - this.Left, rect.Y - this.Top, rect.Width, rect.Height);
                            Bitmap cropped = new Bitmap(localRect.Width, localRect.Height);
                            using (Graphics cg = Graphics.FromImage(cropped))
                            {
                                cg.DrawImage(screenSnapshot, new Rectangle(0, 0, cropped.Width, cropped.Height), localRect, GraphicsUnit.Pixel);
                            }

                            Point spawnPt = new Point(Math.Min(rect.Right + 12, Screen.PrimaryScreen.WorkingArea.Right - 360), Math.Max(rect.Top, Screen.PrimaryScreen.WorkingArea.Top + 20));
                            mainForm.OpenFloatingAnswerWithImage(spawnPt, cropped, "concise");
                            mainForm.LaunchLiveDirectHud(rect);
                        }
                        catch { }
                    }

                    this.Close();
                    this.Dispose();
                }
            };
        }

        private Rectangle GetSelectionRectangle()
        {
            int x = Math.Min(startPoint.X, currentPoint.X);
            int y = Math.Min(startPoint.Y, currentPoint.Y);
            int w = Math.Abs(startPoint.X - currentPoint.X);
            int h = Math.Abs(startPoint.Y - currentPoint.Y);
            return new Rectangle(x, y, w, h);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;

            // 1. رسم الشاشة الأصلية مع طبقة التعتيم المظلمة 50%
            if (screenSnapshot != null)
            {
                g.DrawImage(screenSnapshot, 0, 0, Width, Height);
            }
            using (Brush dimBrush = new SolidBrush(Color.FromArgb(120, 0, 0, 0)))
            {
                g.FillRectangle(dimBrush, ClientRectangle);
            }

            // 2. كشف منطقة التحديد لتصبح واضحة ومضيئة تماماً 100% مثل سكرين شوت ويندوز
            if (isSelecting)
            {
                Rectangle rect = GetSelectionRectangle();
                Rectangle localRect = new Rectangle(rect.X - this.Left, rect.Y - this.Top, rect.Width, rect.Height);

                if (screenSnapshot != null && localRect.Width > 0 && localRect.Height > 0)
                {
                    g.DrawImage(screenSnapshot, localRect, localRect, GraphicsUnit.Pixel);
                }

                using (Pen pen = new Pen(Color.FromArgb(56, 189, 248), 2f))
                {
                    g.DrawRectangle(pen, localRect);
                }

                using (Font df = new Font("Segoe UI", 9f, FontStyle.Bold))
                using (Brush dbg = new SolidBrush(Color.FromArgb(2, 132, 199)))
                using (Brush dtext = new SolidBrush(Color.White))
                {
                    string dim = string.Format("{0} × {1} بكسل", rect.Width, rect.Height);
                    var dsize = g.MeasureString(dim, df);
                    g.FillRectangle(dbg, localRect.Right - (int)dsize.Width - 8, localRect.Bottom + 4, dsize.Width + 6, dsize.Height + 2);
                    g.DrawString(dim, df, dtext, localRect.Right - (int)dsize.Width - 5, localRect.Bottom + 5);
                }
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            base.OnFormClosed(e);
            if (screenSnapshot != null)
            {
                screenSnapshot.Dispose();
                screenSnapshot = null;
            }
        }
    }

    // =========================================================================
    // 7. شريط التحكم أعلى اليمين (زر الإيقاف + العلامة الحمراء المؤشرة)
    // =========================================================================
    public class LiveDirectHudForm : Form
    {
        private MainForm mainForm;
        private Rectangle monitoredRect;
        private System.Windows.Forms.Timer scanTimer;
        private System.Windows.Forms.Timer pulseTimer;
        private Label lblCircle;
        private bool isPulseRed = false;
        private long lastBitmapHash = 0;
        private bool isProcessingStep = false;

        public LiveDirectHudForm(MainForm parent, Rectangle rect)
        {
            this.mainForm = parent;
            this.monitoredRect = rect;

            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.Manual;
            var screen = Screen.PrimaryScreen.WorkingArea;
            this.Location = new Point(screen.Right - 225, screen.Top + 18);
            this.Size = new Size(210, 80);
            this.TopMost = true;
            this.ShowInTaskbar = false;
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            UITheme.ApplyRoundedCard(this, 14, Color.FromArgb(239, 68, 68), 1.5f);

            // زر الإيقاف فوق يمين
            Button btnStop = new Button
            {
                Text = "⏹️ إيقاف الحل المباشر",
                Location = new Point(10, 8),
                Size = new Size(190, 34),
                BackColor = Color.FromArgb(220, 38, 38),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnStop.FlatAppearance.BorderSize = 0;
            UITheme.ApplyRoundedCard(btnStop, 16, Color.FromArgb(248, 113, 113), 1f);
            btnStop.Click += (s, e) => StopLiveDirect();
            this.Controls.Add(btnStop);

            // شريط المؤشر تحته (علامة دائرية حمراء تؤشر وتعني أن الميزة مفعلة)
            Panel pnlIndicator = new Panel
            {
                Location = new Point(10, 48),
                Size = new Size(190, 24),
                BackColor = Color.FromArgb(24, 32, 47)
            };
            UITheme.ApplyRoundedCard(pnlIndicator, 12, Color.FromArgb(71, 85, 105), 1f);

            lblCircle = new Label
            {
                Text = "●",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                ForeColor = Color.FromArgb(239, 68, 68),
                Location = new Point(164, 1),
                Size = new Size(22, 22),
                TextAlign = ContentAlignment.MiddleCenter
            };
            pnlIndicator.Controls.Add(lblCircle);

            Label lblStatus = new Label
            {
                Text = "الحل المباشر مفعّل (نشط)",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(254, 205, 211),
                Location = new Point(8, 3),
                Size = new Size(155, 18),
                TextAlign = ContentAlignment.MiddleRight
            };
            pnlIndicator.Controls.Add(lblStatus);
            this.Controls.Add(pnlIndicator);

            // زر قص سؤال جديد مباشرة من الشريط
            Button btnReSnip = new Button
            {
                Text = "📸 قص سؤال جديد (Ctrl+Shift+S)",
                Location = new Point(10, 78),
                Size = new Size(190, 30),
                BackColor = Color.FromArgb(2, 132, 199),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnReSnip.FlatAppearance.BorderSize = 0;
            UITheme.ApplyRoundedCard(btnReSnip, 12, Color.FromArgb(56, 189, 248), 1f);
            btnReSnip.Click += (s, e) => {
                mainForm.StartLiveDirectModeDesktop();
            };
            this.Controls.Add(btnReSnip);
            this.Size = new Size(210, 118);

            // مؤقت وميض الدائرة الحمراء
            pulseTimer = new System.Windows.Forms.Timer();
            pulseTimer.Interval = 550;
            pulseTimer.Tick += (s, e) => {
                isPulseRed = !isPulseRed;
                lblCircle.ForeColor = isPulseRed ? Color.FromArgb(239, 68, 68) : Color.FromArgb(127, 29, 29);
            };
            pulseTimer.Start();

            // مؤقت الرصد والفحص المستمر كل 1.5 ثانية
            scanTimer = new System.Windows.Forms.Timer();
            scanTimer.Interval = 1500;
            scanTimer.Tick += async (s, e) => await CheckAndSolveFrameAsync();
            scanTimer.Start();

            // فحص أولي فوري
            Task.Run(async () => {
                await Task.Delay(400);
                if (this.IsHandleCreated) this.BeginInvoke(new Action(async () => await CheckAndSolveFrameAsync()));
            });
        }

        public void StopLiveDirect()
        {
            if (scanTimer != null) { scanTimer.Stop(); scanTimer.Dispose(); }
            if (pulseTimer != null) { pulseTimer.Stop(); pulseTimer.Dispose(); }
            this.Close();
            this.Dispose();
        }

        private async Task CheckAndSolveFrameAsync()
        {
            if (isProcessingStep || this.IsDisposed) return;
            isProcessingStep = true;

            try
            {
                int w = Math.Max(monitoredRect.Width, 50);
                int h = Math.Max(monitoredRect.Height, 50);

                Bitmap bmp = new Bitmap(w, h);
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.CopyFromScreen(monitoredRect.Location, Point.Empty, monitoredRect.Size);
                }

                long currentHash = ComputeSimpleHash(bmp);
                if (currentHash != lastBitmapHash)
                {
                    lastBitmapHash = currentHash;
                    Point spawnPt = new Point(Math.Min(monitoredRect.Right + 10, Screen.PrimaryScreen.WorkingArea.Right - 360), Math.Max(monitoredRect.Top, Screen.PrimaryScreen.WorkingArea.Top + 20));
                    mainForm.OpenFloatingAnswerWithImage(spawnPt, bmp, "concise");
                }
                else
                {
                    bmp.Dispose();
                }
            }
            catch { }
            finally
            {
                isProcessingStep = false;
            }
        }

        private long ComputeSimpleHash(Bitmap bmp)
        {
            long hash = 0;
            int stepX = Math.Max(1, bmp.Width / 12);
            int stepY = Math.Max(1, bmp.Height / 12);
            for (int x = 0; x < bmp.Width; x += stepX)
            {
                for (int y = 0; y < bmp.Height; y += stepY)
                {
                    Color c = bmp.GetPixel(x, y);
                    hash = (hash * 31) + c.ToArgb();
                }
            }
            return hash;
        }
    }
}
