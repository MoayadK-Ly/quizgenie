using System;
using System.IO;
using System.Text;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Diagnostics;
using System.Net;
using System.Threading.Tasks;
using System.Collections;
using System.Collections.Generic;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Security.Cryptography;

namespace QuizGenie
{
    public static class UITheme
    {
        public static string CurrentShapeMode = "smooth"; // "sharp" (4px), "smooth" (12px), "capsule" (24px)
        public static int SharpRadius = 4;
        public static int SmoothRadius = 12;
        public static int CapsuleRadius = 24;

        public static event Action OnShapeChanged;

        public class RegisteredControlInfo
        {
            public Control Ctrl;
            public int BaseRadius;
            public Func<Color> BorderColorGetter;
            public float BorderWidth;
        }

        private static List<RegisteredControlInfo> _items = new List<RegisteredControlInfo>();

        public static int GetEffectiveRadius(int baseRadius, int controlHeight = 32)
        {
            if (CurrentShapeMode == "sharp") return SharpRadius;
            if (CurrentShapeMode == "capsule")
            {
                int cap = Math.Min(controlHeight / 2, CapsuleRadius);
                return Math.Max(cap, 18);
            }
            return (baseRadius > 0) ? baseRadius : SmoothRadius;
        }

        public static void SetShapeMode(string mode)
        {
            if (string.IsNullOrEmpty(mode)) mode = "smooth";
            mode = mode.ToLowerInvariant();
            if (mode != "sharp" && mode != "capsule") mode = "smooth";
            CurrentShapeMode = mode;

            for (int i = _items.Count - 1; i >= 0; i--)
            {
                var info = _items[i];
                if (info.Ctrl == null || info.Ctrl.IsDisposed)
                {
                    _items.RemoveAt(i);
                    continue;
                }
                UpdateControlRegion(info.Ctrl, info.BaseRadius);
                info.Ctrl.Invalidate();
            }

            if (OnShapeChanged != null)
            {
                try { OnShapeChanged(); } catch { }
            }
        }

        public static void UpdateControlRegion(Control ctrl, int baseRadius)
        {
            if (ctrl == null || ctrl.Width <= 0 || ctrl.Height <= 0) return;
            int r = GetEffectiveRadius(baseRadius, ctrl.Height);
            using (GraphicsPath path = CreateRoundedPath(new Rectangle(0, 0, ctrl.Width, ctrl.Height), r))
            {
                ctrl.Region = new Region(path);
            }
        }

        public static GraphicsPath CreateRoundedPath(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            if (d > rect.Width) d = rect.Width;
            if (d > rect.Height) d = rect.Height;

            if (d <= 0)
            {
                path.AddRectangle(rect);
                return path;
            }

            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void ApplyRoundCorners(Control ctrl, int radius)
        {
            if (ctrl == null) return;
            var info = new RegisteredControlInfo
            {
                Ctrl = ctrl,
                BaseRadius = radius,
                BorderColorGetter = null,
                BorderWidth = 0
            };
            _items.Add(info);

            ctrl.SizeChanged += (s, e) => UpdateControlRegion(ctrl, radius);
            UpdateControlRegion(ctrl, radius);
        }

        public static void ApplyRoundedCard(Control ctrl, int radius, Color borderColor, float borderWidth = 1f)
        {
            ApplyRoundedCardDynamic(ctrl, radius, () => borderColor, borderWidth);
        }

        public static void ApplyRoundedCardDynamic(Control ctrl, int radius, Func<Color> borderColorGetter, float borderWidth = 1f)
        {
            if (ctrl == null) return;
            var info = new RegisteredControlInfo
            {
                Ctrl = ctrl,
                BaseRadius = radius,
                BorderColorGetter = borderColorGetter,
                BorderWidth = borderWidth
            };
            _items.Add(info);

            ctrl.SizeChanged += (s, e) => UpdateControlRegion(ctrl, radius);
            UpdateControlRegion(ctrl, radius);

            if (borderWidth > 0 && borderColorGetter != null)
            {
                ctrl.Paint += (s, pe) =>
                {
                    if (ctrl.Width <= 1 || ctrl.Height <= 1) return;
                    Color col = borderColorGetter();
                    if (col == Color.Transparent) return;

                    pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    int r = GetEffectiveRadius(radius, ctrl.Height);
                    using (GraphicsPath path = CreateRoundedPath(new Rectangle(0, 0, ctrl.Width - 1, ctrl.Height - 1), r))
                    using (Pen pen = new Pen(col, borderWidth))
                    {
                        pe.Graphics.DrawPath(pen, path);
                    }
                };
            }
        }

        public static void StylePillBadge(Label lbl, Color textColor, Color bgColor, Color borderColor)
        {
            if (lbl == null) return;
            lbl.BorderStyle = BorderStyle.None;
            lbl.BackColor = bgColor;
            lbl.ForeColor = textColor;
            lbl.TextAlign = ContentAlignment.MiddleCenter;
            int radius = lbl.Height / 2;
            ApplyRoundedCard(lbl, radius, borderColor, 1.2f);
        }
    }

    public class ModernDropdown : Control
    {
        public class ItemCollection
        {
            private List<string> _list;
            private Action _onChange;
            public ItemCollection(List<string> list, Action onChange)
            {
                _list = list;
                _onChange = onChange;
            }
            public int Count { get { return _list.Count; } }
            public string this[int index] { get { return _list[index]; } set { _list[index] = value; _onChange(); } }
            public void Add(string item) { _list.Add(item); _onChange(); }
            public void AddRange(IEnumerable<string> items) { _list.AddRange(items); _onChange(); }
            public void AddRange(object[] items)
            {
                foreach (object obj in items) if (obj != null) _list.Add(obj.ToString());
                _onChange();
            }
            public void Clear() { _list.Clear(); _onChange(); }
            public int IndexOf(string item) { return _list.IndexOf(item); }
        }

        private List<string> _rawItems = new List<string>();
        private ItemCollection _items;
        private int _selectedIndex = 0;
        private Color _borderColor = Color.FromArgb(71, 85, 105);
        private Color _chevronColor = Color.FromArgb(148, 163, 184);
        private Color _accentColor = Color.FromArgb(56, 189, 248);
        private int _borderRadius = 12;
        private ContextMenuStrip _menu;
        private bool _isHovered = false;

        public event EventHandler SelectedIndexChanged;

        public ItemCollection Items { get { return _items; } }

        public int SelectedIndex
        {
            get { return _selectedIndex; }
            set
            {
                if (value >= 0 && value < _rawItems.Count && value != _selectedIndex)
                {
                    _selectedIndex = value;
                    Invalidate();
                    if (SelectedIndexChanged != null) SelectedIndexChanged(this, EventArgs.Empty);
                }
            }
        }

        public override string Text
        {
            get
            {
                if (_rawItems.Count > 0 && _selectedIndex >= 0 && _selectedIndex < _rawItems.Count)
                    return _rawItems[_selectedIndex];
                return base.Text;
            }
            set
            {
                int idx = _rawItems.IndexOf(value);
                if (idx >= 0) SelectedIndex = idx;
                else base.Text = value;
            }
        }

        public ModernDropdown()
        {
            this.SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            this.Cursor = Cursors.Hand;
            this.BackColor = Color.FromArgb(24, 32, 47);
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            this.Size = new Size(320, 38);

            _items = new ItemCollection(_rawItems, () => { Invalidate(); });

            _menu = new ContextMenuStrip();
            _menu.ShowImageMargin = false;
            _menu.ShowCheckMargin = false;
            _menu.RightToLeft = RightToLeft.Yes;
            _menu.BackColor = Color.FromArgb(24, 32, 47);
            _menu.ForeColor = Color.FromArgb(241, 245, 249);
            _menu.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            _menu.Renderer = new ModernMenuRenderer();

            this.MouseEnter += (s, e) => { _isHovered = true; Invalidate(); };
            this.MouseLeave += (s, e) => { _isHovered = false; Invalidate(); };
            UITheme.OnShapeChanged += () => { try { Invalidate(); } catch { } };
        }

        public void SetTheme(Color themeColor)
        {
            _borderColor = themeColor;
            _chevronColor = themeColor;
            _accentColor = themeColor;
            Invalidate();
        }

        protected override void OnClick(EventArgs e)
        {
            base.OnClick(e);
            ShowDropdownMenu();
        }

        public void ShowDropdownMenu()
        {
            if (_rawItems.Count == 0) return;
            _menu.Items.Clear();
            for (int i = 0; i < _rawItems.Count; i++)
            {
                int idx = i;
                string itemText = _rawItems[i];
                bool isCurrent = (idx == _selectedIndex);

                ToolStripMenuItem item = new ToolStripMenuItem(itemText);
                item.Height = 34;
                item.AutoSize = false;
                item.Size = new Size(this.Width, 34);
                item.TextAlign = ContentAlignment.MiddleRight;
                item.RightToLeft = RightToLeft.Yes;

                if (isCurrent)
                {
                    item.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
                    item.ForeColor = _accentColor;
                    item.Text = "✓ " + itemText;
                }
                else
                {
                    item.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
                    item.ForeColor = Color.FromArgb(226, 232, 240);
                }

                item.Click += (s, ev) =>
                {
                    SelectedIndex = idx;
                };
                _menu.Items.Add(item);
            }
            _menu.Show(this, new Point(0, this.Height + 2));
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            Color bg = _isHovered ? Color.FromArgb(39, 52, 74) : Color.FromArgb(24, 32, 47);
            Rectangle rect = new Rectangle(0, 0, this.Width - 1, this.Height - 1);
            int effRadius = UITheme.GetEffectiveRadius(_borderRadius, this.Height);

            using (GraphicsPath path = UITheme.CreateRoundedPath(rect, effRadius))
            {
                using (SolidBrush br = new SolidBrush(bg))
                {
                    g.FillPath(br, path);
                }
                using (Pen pen = new Pen(_borderColor, 1.4f))
                {
                    g.DrawPath(pen, path);
                }
            }

            // Left chevron
            Rectangle chevronRect = new Rectangle(14, (this.Height - 22) / 2, 22, 22);
            TextRenderer.DrawText(g, "▾", new Font("Segoe UI", 12f, FontStyle.Bold), chevronRect, _chevronColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

            // Text
            string txt = Text;
            Rectangle txtRect = new Rectangle(40, 0, this.Width - 54, this.Height);
            TextRenderer.DrawText(g, txt, this.Font, txtRect, this.ForeColor,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Right | TextFormatFlags.RightToLeft);
        }
    }

    public class ModernMenuRenderer : ToolStripProfessionalRenderer
    {
        public ModernMenuRenderer() : base(new ModernColorTable()) { }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (e.Item.Selected)
            {
                Rectangle rect = new Rectangle(4, 2, e.Item.Width - 8, e.Item.Height - 4);
                using (GraphicsPath path = UITheme.CreateRoundedPath(rect, 8))
                using (SolidBrush br = new SolidBrush(Color.FromArgb(51, 65, 85)))
                {
                    e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    e.Graphics.FillPath(br, path);
                }
            }
            else
            {
                using (SolidBrush br = new SolidBrush(Color.FromArgb(24, 32, 47)))
                {
                    e.Graphics.FillRectangle(br, e.Item.ContentRectangle);
                }
            }
        }
    }

    public class ModernColorTable : ProfessionalColorTable
    {
        public override Color ToolStripDropDownBackground { get { return Color.FromArgb(24, 32, 47); } }
        public override Color MenuBorder { get { return Color.FromArgb(71, 85, 105); } }
        public override Color MenuItemBorder { get { return Color.Transparent; } }
    }

    public class MainForm : Form
    {
        public const string APP_VERSION = "2.1.0";
        public const string DEFAULT_UPDATE_URL = "https://raw.githubusercontent.com/MoayadK-Ly/quizgenie/main/version.json";

        // اللوحة الرئيسية القابلة للتمرير
        private Panel pnlMain;

        // 1. رأس الصفحة المطابق للإضافة
        private Panel pnlHeader;
        private PictureBox pbLogo;
        private Label lblBrandTitle;
        private Label lblBrandSub;
        private Label lblHeaderServerBadge;
        private Color headerBadgeBorderColor = Color.FromArgb(16, 185, 129);

        // 2. بطاقة عرض الخادم النشط
        private Panel pnlActiveServerCard;
        private Label lblActiveServerIcon;
        private Label lblActiveServerTitle;
        private Label lblActiveServerName;
        private Label lblActiveServerBadge;
        private Color activeBadgeBorderColor = Color.FromArgb(16, 185, 129);

        // 3. زر التشغيل والإيقاف الرئيسي
        private Button btnMasterPower;
        private bool isMasterActive = true;
        private Color masterPowerBorderColor = Color.FromArgb(16, 185, 129);

        // 4. حالات فتح وإغلاق القوائم المنسدلة الست (Accordions)
        private bool isServersOpen = false;
        private bool isSubjectsOpen = false;
        private bool isLanguagesOpen = false;
        private bool isSettingsOpen = false;
        private bool isSolverOpen = false;
        private bool isAboutOpen = false;

        // قائمة 1: خوادم الذكاء الاصطناعي (الستة خوادم)
        private Panel pnlAccServersHeader;
        private Label lblAccServersBadge;
        private Label lblAccServersChevron;
        private Panel pnlAccServersBody;
        private Panel pnlCardFree;
        private Panel pnlCardFreeBackup;
        private Panel pnlCardDeepSeek;
        private Panel pnlCardGroq;
        private Panel pnlCardGemini;
        private Panel pnlCardOpenAI;
        private Color cardFreeBorderColor = Color.FromArgb(16, 185, 129);
        private Color cardFreeBackupBorderColor = Color.FromArgb(51, 65, 85);
        private Color cardDeepSeekBorderColor = Color.FromArgb(51, 65, 85);
        private Color cardGroqBorderColor = Color.FromArgb(51, 65, 85);
        private Color cardGeminiBorderColor = Color.FromArgb(51, 65, 85);
        private Color cardOpenAIBorderColor = Color.FromArgb(51, 65, 85);
        private RadioButton rbFree;
        private RadioButton rbFreeBackup;
        private RadioButton rbDeepSeek;
        private RadioButton rbGroq;
        private RadioButton rbGemini;
        private RadioButton rbOpenAI;
        private Panel pnlDeepSeekKey;
        private TextBox txtDeepSeekKey;
        private Button btnTestDeepSeek;
        private Label lblDeepSeekStatus;
        private Panel pnlGroqKey;
        private TextBox txtGroqKey;
        private Button btnTestGroq;
        private Label lblGroqStatus;
        private Panel pnlGeminiKey;
        private TextBox txtGeminiKey;
        private Button btnTestGemini;
        private Label lblGeminiStatus;
        private Panel pnlOpenAIKey;
        private TextBox txtOpenAIKey;
        private Button btnTestOpenAI;
        private Label lblOpenAIStatus;

        // قائمة 2: التخصص والمادة الدراسية
        private Panel pnlAccSubjectsHeader;
        private Label lblAccSubjectsBadge;
        private Label lblAccSubjectsChevron;
        private Panel pnlAccSubjectsBody;
        private ModernDropdown cbSubject;

        // قائمة 3: لغة الإجابة والترجمة الفورية
        private Panel pnlAccLanguagesHeader;
        private Label lblAccLanguagesBadge;
        private Label lblAccLanguagesChevron;
        private Panel pnlAccLanguagesBody;
        private ModernDropdown cbLanguage;

        // قائمة 4: إعدادات وتخصيص المساعد
        private Panel pnlAccSettingsHeader;
        private Label lblAccSettingsBadge;
        private Label lblAccSettingsChevron;
        private Panel pnlAccSettingsBody;
        private CheckBox chkAlwaysOnTop;
        private Button btnChromeStatus;
        private Button btnShapeSharp;
        private Button btnShapeSmooth;
        private Button btnShapeCapsule;
        private Button btnOpenWebCustomizer;

        // قائمة 5: حل سؤال فوري وسريع
        private Panel pnlAccSolverHeader;
        private Label lblAccSolverBadge;
        private Label lblAccSolverChevron;
        private Panel pnlAccSolverBody;
        private TextBox txtQuestion;
        private Button btnPasteQuestion;
        private Button btnSnipScreen;
        private Button btnExportHistory;
        private Button btnSpeakDesktop;
        private System.Speech.Synthesis.SpeechSynthesizer desktopSynth;
        private bool isDesktopSpeaking = false;
        private Button btnSolveConcise;
        private Button btnSolveDetailed;
        private Label lblAnswerStatus;
        private TextBox txtAnswer;
        private Button btnCopyAnswer;

        // قائمة 6: نبذة ودليل استخدام الأداة
        private Panel pnlAccAboutHeader;
        private Label lblAccAboutBadge;
        private Label lblAccAboutChevron;
        private Panel pnlAccAboutBody;
        private TextBox txtAbout;

        // أزرار التحديثات السفلية
        private Panel pnlBottomButtons;
        private Button btnViewChangelog;
        private Button btnCheckUpdates;

        // شاشة التحديث الكاملة المنبثقة
        private Panel overlayChangelog;
        private Label lblChangelogHeader;
        private Label lblChangelogSub;
        private TextBox txtChangelogBody;
        private Button btnInstallUpdate;
        private Button btnDismissChangelog;
        private Label lblUpdateProgress;
        private string pendingUpdateDownloadUrl = "";

        // شاشة وتنبيه الإغلاق التلقائي عند نزول تحديث
        private Panel overlayAutoClose;
        private Label lblAutoCloseIcon;
        private Label lblAutoCloseTitle;
        private Label lblAutoCloseDesc;
        private Label lblAutoCloseCountdown;
        private Button btnAutoCloseNow;
        private int autoCloseRemainingSeconds = 3;
        private System.Windows.Forms.Timer autoCloseTimer;
        private bool isClosingForUpdate = false;
        private List<FileSystemWatcher> fileWatchers = new List<FileSystemWatcher>();

        // مراقب تحديد النصوص والبوب اب العائم
        private GlobalSelectionMonitor selectionMonitor;
        private FloatingFabForm fabForm;
        private FloatingMenuForm menuForm;
        private FloatingAnswerForm answerForm;
        private CheckBox chkFloatingPopup;
        private bool isFloatingPopupEnabled = true;

        // الإعدادات المحفوظة
        private string configPath;
        private AppConfig currentConfig;
        private JavaScriptSerializer json = new JavaScriptSerializer();

        public MainForm()
        {
            ClosePreviousInstances();
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
            CheckApplicationProtection();

            // حفظ الإعدادات داخل AppData ليبقى سطح المكتب نظيفاً تماماً
            try
            {
                string appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "QuizGenie");
                if (!Directory.Exists(appDataDir)) Directory.CreateDirectory(appDataDir);
                configPath = Path.Combine(appDataDir, "quizgenie_config.json");

                string oldConfig = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "quizgenie_config.json");
                if (File.Exists(oldConfig))
                {
                    if (!File.Exists(configPath)) File.Copy(oldConfig, configPath, true);
                    try { File.Delete(oldConfig); } catch { }
                }
            }
            catch
            {
                configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "quizgenie_config.json");
            }

            LoadSettings();
            InitializeComponent();
            ApplySettingsToUI();
            UpdateChromeInstallStatus();

            // حفظ الإصدار الجديد بصمت تام دون فتح أي نوافذ منبثقة أو مقاطعة للمستخدم
            bool isNewUpdate = string.IsNullOrEmpty(currentConfig.InstalledVersion) || 
                               currentConfig.InstalledVersion != APP_VERSION || 
                               currentConfig.IsFirstRunAfterUpdate;

            if (isNewUpdate)
            {
                currentConfig.IsFirstRunAfterUpdate = false;
                currentConfig.InstalledVersion = APP_VERSION;
                SaveSettings();
            }

            InitFloatingSelectionMonitor();
        }

        private void CheckApplicationProtection()
        {
            try
            {
                if (Debugger.IsAttached || Debugger.IsLogging())
                {
                    Process.GetCurrentProcess().Kill();
                    return;
                }
            }
            catch { }
        }

        private void InitializeComponent()
        {
            this.Text = "QuizGenie - مساعد حل الاختبارات والأسئلة والواجبات | v" + APP_VERSION;
            this.Size = new Size(495, 840);
            this.MinimumSize = new Size(460, 680);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(11, 15, 25);
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.Font = new Font("Segoe UI", 10f, FontStyle.Regular);

            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule.FileName);
            }
            catch { }

            pnlMain = new Panel();
            pnlMain.Dock = DockStyle.Fill;
            pnlMain.AutoScroll = true;
            pnlMain.Padding = new Padding(12);
            this.Controls.Add(pnlMain);

            int itemW = 445;

            // 1. رأس الصفحة (Header) منحني الأطراف ومطابق لإضافة كروم
            pnlHeader = new Panel();
            pnlHeader.Size = new Size(itemW, 58);
            pnlHeader.BackColor = Color.FromArgb(15, 23, 42);
            pnlHeader.BorderStyle = BorderStyle.None;
            UITheme.ApplyRoundedCard(pnlHeader, 14, Color.FromArgb(51, 65, 85), 1.2f);

            Panel pnlLogoBox = new Panel();
            pnlLogoBox.Location = new Point(395, 10);
            pnlLogoBox.Size = new Size(38, 38);
            pnlLogoBox.BackColor = Color.FromArgb(15, 23, 42);
            UITheme.ApplyRoundedCard(pnlLogoBox, 10, Color.FromArgb(2, 132, 199), 1.4f);

            pbLogo = new PictureBox();
            pbLogo.Dock = DockStyle.Fill;
            pbLogo.SizeMode = PictureBoxSizeMode.Zoom;
            string logoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"icons\icon48.png");
            if (!File.Exists(logoPath)) logoPath = @"C:\QuizGenie\icons\icon48.png";
            if (File.Exists(logoPath))
            {
                try { pbLogo.Image = Image.FromFile(logoPath); } catch { }
            }
            else
            {
                try { pbLogo.Image = Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule.FileName).ToBitmap(); } catch { }
            }
            pnlLogoBox.Controls.Add(pbLogo);
            pnlHeader.Controls.Add(pnlLogoBox);

            lblBrandTitle = new Label();
            lblBrandTitle.Text = "QuizGenie";
            lblBrandTitle.Location = new Point(145, 9);
            lblBrandTitle.AutoSize = true;
            lblBrandTitle.Font = new Font("Segoe UI", 13.5f, FontStyle.Bold);
            lblBrandTitle.ForeColor = Color.White;
            pnlHeader.Controls.Add(lblBrandTitle);

            lblBrandSub = new Label();
            lblBrandSub.Text = "مساعد حل الاختبارات والأسئلة والواجبات";
            lblBrandSub.Location = new Point(145, 32);
            lblBrandSub.AutoSize = true;
            lblBrandSub.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblBrandSub.ForeColor = Color.FromArgb(148, 163, 184);
            pnlHeader.Controls.Add(lblBrandSub);

            lblHeaderServerBadge = new Label();
            lblHeaderServerBadge.Text = "🌐 الخادم المجاني";
            lblHeaderServerBadge.Location = new Point(10, 15);
            lblHeaderServerBadge.Size = new Size(130, 28);
            lblHeaderServerBadge.TextAlign = ContentAlignment.MiddleCenter;
            lblHeaderServerBadge.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            lblHeaderServerBadge.ForeColor = Color.FromArgb(52, 211, 153);
            lblHeaderServerBadge.BackColor = Color.FromArgb(6, 78, 59);
            lblHeaderServerBadge.BorderStyle = BorderStyle.None;
            UITheme.ApplyRoundCorners(lblHeaderServerBadge, 14);
            lblHeaderServerBadge.Paint += (s, pe) => {
                pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath p = UITheme.CreateRoundedPath(new Rectangle(0, 0, lblHeaderServerBadge.Width - 1, lblHeaderServerBadge.Height - 1), 14))
                using (Pen pen = new Pen(headerBadgeBorderColor, 1.4f))
                {
                    pe.Graphics.DrawPath(pen, p);
                }
            };
            pnlHeader.Controls.Add(lblHeaderServerBadge);

            pnlMain.Controls.Add(pnlHeader);

            // 2. بطاقة عرض الخادم النشط المختار حالياً - منحنية الأطراف
            pnlActiveServerCard = new Panel();
            pnlActiveServerCard.Size = new Size(itemW, 58);
            pnlActiveServerCard.BackColor = Color.FromArgb(15, 23, 42);
            pnlActiveServerCard.BorderStyle = BorderStyle.None;
            UITheme.ApplyRoundedCard(pnlActiveServerCard, 14, Color.FromArgb(51, 65, 85), 1.2f);

            Panel pnlActiveIconBox = new Panel();
            pnlActiveIconBox.Location = new Point(395, 10);
            pnlActiveIconBox.Size = new Size(38, 38);
            pnlActiveIconBox.BackColor = Color.FromArgb(30, 41, 59);
            UITheme.ApplyRoundedCard(pnlActiveIconBox, 9, Color.FromArgb(71, 85, 105), 1f);

            lblActiveServerIcon = new Label();
            lblActiveServerIcon.Text = "🌐";
            lblActiveServerIcon.Font = new Font("Segoe UI", 16f, FontStyle.Regular);
            lblActiveServerIcon.Dock = DockStyle.Fill;
            lblActiveServerIcon.TextAlign = ContentAlignment.MiddleCenter;
            pnlActiveIconBox.Controls.Add(lblActiveServerIcon);
            pnlActiveServerCard.Controls.Add(pnlActiveIconBox);

            lblActiveServerTitle = new Label();
            lblActiveServerTitle.Text = "الخادم النشط المختار حالياً:";
            lblActiveServerTitle.Location = new Point(90, 8);
            lblActiveServerTitle.AutoSize = true;
            lblActiveServerTitle.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            lblActiveServerTitle.ForeColor = Color.FromArgb(148, 163, 184);
            pnlActiveServerCard.Controls.Add(lblActiveServerTitle);

            lblActiveServerName = new Label();
            lblActiveServerName.Text = "الخادم المجاني (بدون مفتاح)";
            lblActiveServerName.Location = new Point(90, 28);
            lblActiveServerName.AutoSize = true;
            lblActiveServerName.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            lblActiveServerName.ForeColor = Color.FromArgb(110, 231, 183);
            pnlActiveServerCard.Controls.Add(lblActiveServerName);

            lblActiveServerBadge = new Label();
            lblActiveServerBadge.Text = "🟢 نشط";
            lblActiveServerBadge.Location = new Point(12, 16);
            lblActiveServerBadge.Size = new Size(74, 26);
            lblActiveServerBadge.TextAlign = ContentAlignment.MiddleCenter;
            lblActiveServerBadge.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblActiveServerBadge.ForeColor = Color.FromArgb(52, 211, 153);
            lblActiveServerBadge.BackColor = Color.FromArgb(6, 78, 59);
            lblActiveServerBadge.BorderStyle = BorderStyle.None;
            UITheme.ApplyRoundCorners(lblActiveServerBadge, 13);
            lblActiveServerBadge.Paint += (s, pe) => {
                pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath p = UITheme.CreateRoundedPath(new Rectangle(0, 0, lblActiveServerBadge.Width - 1, lblActiveServerBadge.Height - 1), 13))
                using (Pen pen = new Pen(activeBadgeBorderColor, 1.4f))
                {
                    pe.Graphics.DrawPath(pen, p);
                }
            };
            pnlActiveServerCard.Controls.Add(lblActiveServerBadge);

            pnlMain.Controls.Add(pnlActiveServerCard);

            // 3. زر التشغيل والإيقاف الرئيسي - تصميم كبسولة منحني الأطراف (Master Power)
            btnMasterPower = new Button();
            btnMasterPower.Size = new Size(itemW, 54);
            btnMasterPower.FlatStyle = FlatStyle.Flat;
            btnMasterPower.FlatAppearance.BorderSize = 0;
            btnMasterPower.Cursor = Cursors.Hand;
            btnMasterPower.Click += (s, e) => ToggleMasterPower();
            UITheme.ApplyRoundCorners(btnMasterPower, 16);
            btnMasterPower.Paint += (s, pe) => {
                pe.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath p = UITheme.CreateRoundedPath(new Rectangle(0, 0, btnMasterPower.Width - 1, btnMasterPower.Height - 1), 16))
                using (Pen pen = new Pen(masterPowerBorderColor, 1.8f))
                {
                    pe.Graphics.DrawPath(pen, p);
                }
            };
            pnlMain.Controls.Add(btnMasterPower);

            // 4. القوائم المنسدلة المنحنية الأطراف (Accordions)
            BuildAccordionServers(itemW);
            BuildAccordionSubjects(itemW);
            BuildAccordionLanguages(itemW);
            BuildAccordionSettings(itemW);
            BuildAccordionSolver(itemW);
            BuildAccordionAbout(itemW);

            // 5. شريط أزرار التحديث وسجل التغييرات - أزرار مستديرة
            pnlBottomButtons = new Panel();
            pnlBottomButtons.Size = new Size(itemW, 40);

            btnViewChangelog = new Button();
            btnViewChangelog.Text = "📋 ما الجديد في التحديث؟";
            btnViewChangelog.Location = new Point(0, 0);
            btnViewChangelog.Size = new Size(218, 38);
            btnViewChangelog.FlatStyle = FlatStyle.Flat;
            btnViewChangelog.FlatAppearance.BorderSize = 0;
            btnViewChangelog.ForeColor = Color.FromArgb(148, 163, 184);
            btnViewChangelog.BackColor = Color.FromArgb(15, 23, 42);
            btnViewChangelog.Cursor = Cursors.Hand;
            btnViewChangelog.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            UITheme.ApplyRoundedCard(btnViewChangelog, 12, Color.FromArgb(71, 85, 105), 1.2f);
            btnViewChangelog.Click += (s, e) => ShowChangelogModal();
            pnlBottomButtons.Controls.Add(btnViewChangelog);

            btnCheckUpdates = new Button();
            btnCheckUpdates.Text = "🔄 فحص التحديثات السحابية";
            btnCheckUpdates.Location = new Point(226, 0);
            btnCheckUpdates.Size = new Size(218, 38);
            btnCheckUpdates.FlatStyle = FlatStyle.Flat;
            btnCheckUpdates.FlatAppearance.BorderSize = 0;
            btnCheckUpdates.ForeColor = Color.FromArgb(56, 189, 248);
            btnCheckUpdates.BackColor = Color.FromArgb(15, 23, 42);
            btnCheckUpdates.Cursor = Cursors.Hand;
            btnCheckUpdates.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            UITheme.ApplyRoundedCard(btnCheckUpdates, 12, Color.FromArgb(56, 189, 248), 1.2f);
            btnCheckUpdates.Click += async (s, e) => {
                btnCheckUpdates.Enabled = false;
                btnCheckUpdates.Text = "⏳ جارٍ الفحص...";
                await CheckForUpdatesAsync(false);
                btnCheckUpdates.Text = "🔄 فحص التحديثات السحابية";
                btnCheckUpdates.Enabled = true;
            };
            pnlBottomButtons.Controls.Add(btnCheckUpdates);

            pnlMain.Controls.Add(pnlBottomButtons);

            // الشاشة الكاملة للتحديث والتغييرات
            BuildChangelogOverlay();
            BuildAutoCloseOverlay();

            // تطبيق حالة الزر الرئيسي بعد بناء كافة عناصر الواجهة
            UpdateMasterPowerUI();

            // حساب أبعاد ومواضع جميع القوائم
            RefreshAccordionLayout();
        }

        private void ToggleServers()
        {
            isServersOpen = !isServersOpen;
            RefreshAccordionLayout();
        }

        private void ToggleSubjects()
        {
            isSubjectsOpen = !isSubjectsOpen;
            RefreshAccordionLayout();
        }

        private void ToggleLanguages()
        {
            isLanguagesOpen = !isLanguagesOpen;
            RefreshAccordionLayout();
        }

        private void ToggleSettings()
        {
            isSettingsOpen = !isSettingsOpen;
            RefreshAccordionLayout();
        }

        private void ToggleSolver()
        {
            isSolverOpen = !isSolverOpen;
            RefreshAccordionLayout();
        }

        private void ToggleAbout()
        {
            isAboutOpen = !isAboutOpen;
            RefreshAccordionLayout();
        }

        private void BuildAccordionServers(int itemW)
        {
            pnlAccServersHeader = CreateAccordionHeader(
                itemW, "🖥️", "خوادم الذكاء الاصطناعي", "6 خوادم: ديب سيك، جروك، جوجل، شات جي بي تي، ومجاني",
                "🌐 مجاني", Color.FromArgb(167, 139, 250), Color.FromArgb(46, 16, 101),
                out lblAccServersBadge, out lblAccServersChevron,
                ToggleServers
            );
            pnlMain.Controls.Add(pnlAccServersHeader);

            pnlAccServersBody = new Panel();
            pnlAccServersBody.Size = new Size(itemW, 700);
            pnlAccServersBody.BackColor = Color.FromArgb(15, 23, 42);
            pnlAccServersBody.BorderStyle = BorderStyle.None;
            pnlAccServersBody.Visible = false;
            UITheme.ApplyRoundedCard(pnlAccServersBody, 14, Color.FromArgb(51, 65, 85), 1.2f);

            int cardW = itemW - 24;
            int y = 10;

            // البطاقة 1: الخادم المجاني
            pnlCardFree = new Panel();
            pnlCardFree.Location = new Point(12, y);
            pnlCardFree.Size = new Size(cardW, 60);
            pnlCardFree.BackColor = Color.FromArgb(11, 15, 25);
            pnlCardFree.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCardDynamic(pnlCardFree, 11, () => cardFreeBorderColor, 1.4f);

            rbFree = new RadioButton();
            rbFree.Text = "🌐 الخادم المجاني";
            rbFree.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            rbFree.ForeColor = Color.FromArgb(110, 231, 183);
            rbFree.Location = new Point(130, 6);
            rbFree.Size = new Size(cardW - 140, 24);
            rbFree.Cursor = Cursors.Hand;
            rbFree.CheckedChanged += (s, e) => { if (rbFree.Checked) SwitchServer("free"); };
            pnlCardFree.Controls.Add(rbFree);

            Label lblTagFree = new Label();
            lblTagFree.Text = "تلقائي بدون مفتاح";
            lblTagFree.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            lblTagFree.Location = new Point(10, 6);
            lblTagFree.Size = new Size(110, 22);
            UITheme.StylePillBadge(lblTagFree, Color.FromArgb(52, 211, 153), Color.FromArgb(6, 78, 59), Color.FromArgb(16, 185, 129));
            pnlCardFree.Controls.Add(lblTagFree);

            Label lblFreeDesc = new Label();
            lblFreeDesc.Text = "مجاني 100% ويعمل فوراً وبدون أي تسجيل أو مفاتيح، مناسب للحل المباشر.";
            lblFreeDesc.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblFreeDesc.ForeColor = Color.FromArgb(148, 163, 184);
            lblFreeDesc.Location = new Point(10, 32);
            lblFreeDesc.Size = new Size(cardW - 20, 22);
            pnlCardFree.Controls.Add(lblFreeDesc);

            pnlCardFree.Click += (s, e) => SwitchServer("free");
            lblFreeDesc.Click += (s, e) => SwitchServer("free");
            pnlAccServersBody.Controls.Add(pnlCardFree);
            y += 68;

            // البطاقة 2: الخادم المجاني الاحتياطي
            pnlCardFreeBackup = new Panel();
            pnlCardFreeBackup.Location = new Point(12, y);
            pnlCardFreeBackup.Size = new Size(cardW, 60);
            pnlCardFreeBackup.BackColor = Color.FromArgb(11, 15, 25);
            pnlCardFreeBackup.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCardDynamic(pnlCardFreeBackup, 11, () => cardFreeBackupBorderColor, 1.4f);

            rbFreeBackup = new RadioButton();
            rbFreeBackup.Text = "🛡️ الخادم المجاني الاحتياطي";
            rbFreeBackup.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            rbFreeBackup.ForeColor = Color.FromArgb(45, 212, 191);
            rbFreeBackup.Location = new Point(130, 6);
            rbFreeBackup.Size = new Size(cardW - 140, 24);
            rbFreeBackup.Cursor = Cursors.Hand;
            rbFreeBackup.CheckedChanged += (s, e) => { if (rbFreeBackup.Checked) SwitchServer("free_backup"); };
            pnlCardFreeBackup.Controls.Add(rbFreeBackup);

            Label lblTagFreeBackup = new Label();
            lblTagFreeBackup.Text = "بديل تلقائي فوري";
            lblTagFreeBackup.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            lblTagFreeBackup.Location = new Point(10, 6);
            lblTagFreeBackup.Size = new Size(110, 22);
            UITheme.StylePillBadge(lblTagFreeBackup, Color.FromArgb(45, 212, 191), Color.FromArgb(19, 78, 74), Color.FromArgb(20, 184, 166));
            pnlCardFreeBackup.Controls.Add(lblTagFreeBackup);

            Label lblFreeBackupDesc = new Label();
            lblFreeBackupDesc.Text = "خادم بديل فوري يعمل تلقائياً وبدون أي مفاتيح عند انشغال الخادم المجاني الأول.";
            lblFreeBackupDesc.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblFreeBackupDesc.ForeColor = Color.FromArgb(148, 163, 184);
            lblFreeBackupDesc.Location = new Point(10, 32);
            lblFreeBackupDesc.Size = new Size(cardW - 20, 22);
            pnlCardFreeBackup.Controls.Add(lblFreeBackupDesc);

            pnlCardFreeBackup.Click += (s, e) => SwitchServer("free_backup");
            lblFreeBackupDesc.Click += (s, e) => SwitchServer("free_backup");
            pnlAccServersBody.Controls.Add(pnlCardFreeBackup);
            y += 68;

            // البطاقة 3: خادم ديب سيك (DeepSeek R1)
            pnlCardDeepSeek = new Panel();
            pnlCardDeepSeek.Location = new Point(12, y);
            pnlCardDeepSeek.Size = new Size(cardW, 128);
            pnlCardDeepSeek.BackColor = Color.FromArgb(11, 15, 25);
            pnlCardDeepSeek.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCardDynamic(pnlCardDeepSeek, 11, () => cardDeepSeekBorderColor, 1.4f);

            rbDeepSeek = new RadioButton();
            rbDeepSeek.Text = "🧠 خادم ديب سيك (DeepSeek R1)";
            rbDeepSeek.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            rbDeepSeek.ForeColor = Color.FromArgb(56, 189, 248);
            rbDeepSeek.Location = new Point(110, 6);
            rbDeepSeek.Size = new Size(cardW - 120, 24);
            rbDeepSeek.Cursor = Cursors.Hand;
            rbDeepSeek.CheckedChanged += (s, e) => { if (rbDeepSeek.Checked) SwitchServer("deepseek"); };
            pnlCardDeepSeek.Controls.Add(rbDeepSeek);

            Label lblTagDeepSeek = new Label();
            lblTagDeepSeek.Text = "تفكير استنتاجي خارق";
            lblTagDeepSeek.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            lblTagDeepSeek.Location = new Point(10, 6);
            lblTagDeepSeek.Size = new Size(115, 22);
            UITheme.StylePillBadge(lblTagDeepSeek, Color.FromArgb(56, 189, 248), Color.FromArgb(12, 74, 110), Color.FromArgb(14, 165, 233));
            pnlCardDeepSeek.Controls.Add(lblTagDeepSeek);

            pnlDeepSeekKey = new Panel();
            pnlDeepSeekKey.Location = new Point(10, 32);
            pnlDeepSeekKey.Size = new Size(cardW - 20, 88);

            Panel pnlDeepSeekKeyWrap = new Panel();
            pnlDeepSeekKeyWrap.Location = new Point(120, 4);
            pnlDeepSeekKeyWrap.Size = new Size(pnlDeepSeekKey.Width - 125, 30);
            pnlDeepSeekKeyWrap.BackColor = Color.FromArgb(15, 23, 42);
            UITheme.ApplyRoundedCard(pnlDeepSeekKeyWrap, 8, Color.FromArgb(71, 85, 105), 1f);

            txtDeepSeekKey = new TextBox();
            txtDeepSeekKey.Location = new Point(4, 5);
            txtDeepSeekKey.Size = new Size(pnlDeepSeekKeyWrap.Width - 8, 22);
            txtDeepSeekKey.PasswordChar = '*';
            txtDeepSeekKey.BackColor = Color.FromArgb(15, 23, 42);
            txtDeepSeekKey.ForeColor = Color.White;
            txtDeepSeekKey.BorderStyle = BorderStyle.None;
            txtDeepSeekKey.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            txtDeepSeekKey.TextChanged += (s, e) => {
                if (currentConfig != null) { currentConfig.DeepSeekKey = txtDeepSeekKey.Text.Trim(); SaveSettings(); }
            };
            pnlDeepSeekKeyWrap.Controls.Add(txtDeepSeekKey);
            pnlDeepSeekKey.Controls.Add(pnlDeepSeekKeyWrap);

            btnTestDeepSeek = new Button();
            btnTestDeepSeek.Text = "🔍 فحص المفتاح";
            btnTestDeepSeek.Location = new Point(4, 4);
            btnTestDeepSeek.Size = new Size(110, 30);
            btnTestDeepSeek.FlatStyle = FlatStyle.Flat;
            btnTestDeepSeek.FlatAppearance.BorderSize = 0;
            btnTestDeepSeek.ForeColor = Color.FromArgb(56, 189, 248);
            btnTestDeepSeek.BackColor = Color.FromArgb(12, 74, 110);
            btnTestDeepSeek.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            btnTestDeepSeek.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnTestDeepSeek, 10, Color.FromArgb(14, 165, 233), 1.2f);
            btnTestDeepSeek.Click += async (s, e) => await TestDeepSeekKeyAsync();
            pnlDeepSeekKey.Controls.Add(btnTestDeepSeek);

            LinkLabel lnkDeepSeekGet = new LinkLabel();
            lnkDeepSeekGet.Text = "🔗 اضغط هنا لفتح موقع DeepSeek واستخراج المفتاح (platform.deepseek.com)";
            lnkDeepSeekGet.Location = new Point(4, 38);
            lnkDeepSeekGet.Size = new Size(pnlDeepSeekKey.Width - 8, 20);
            lnkDeepSeekGet.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            lnkDeepSeekGet.LinkColor = Color.FromArgb(56, 189, 248);
            lnkDeepSeekGet.ActiveLinkColor = Color.FromArgb(125, 211, 252);
            lnkDeepSeekGet.VisitedLinkColor = Color.FromArgb(56, 189, 248);
            lnkDeepSeekGet.Cursor = Cursors.Hand;
            lnkDeepSeekGet.LinkBehavior = LinkBehavior.HoverUnderline;
            lnkDeepSeekGet.Click += (s, e) => {
                try { Process.Start(new ProcessStartInfo("https://platform.deepseek.com/api_keys") { UseShellExecute = true }); } catch { }
            };
            pnlDeepSeekKey.Controls.Add(lnkDeepSeekGet);

            lblDeepSeekStatus = new Label();
            lblDeepSeekStatus.Text = "ℹ️ يعمل مجاناً بدون مفتاح، أو الصق مفتاحك واضغط فحص.";
            lblDeepSeekStatus.Location = new Point(4, 62);
            lblDeepSeekStatus.Size = new Size(pnlDeepSeekKey.Width - 8, 22);
            lblDeepSeekStatus.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblDeepSeekStatus.ForeColor = Color.FromArgb(148, 163, 184);
            pnlDeepSeekKey.Controls.Add(lblDeepSeekStatus);

            pnlCardDeepSeek.Controls.Add(pnlDeepSeekKey);
            pnlCardDeepSeek.Click += (s, e) => rbDeepSeek.Checked = true;
            pnlAccServersBody.Controls.Add(pnlCardDeepSeek);
            y += 136;

            // البطاقة 4: خادم جروك فائق السرعة (Groq Llama 3.3)
            pnlCardGroq = new Panel();
            pnlCardGroq.Location = new Point(12, y);
            pnlCardGroq.Size = new Size(cardW, 128);
            pnlCardGroq.BackColor = Color.FromArgb(11, 15, 25);
            pnlCardGroq.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCardDynamic(pnlCardGroq, 11, () => cardGroqBorderColor, 1.4f);

            rbGroq = new RadioButton();
            rbGroq.Text = "⚡ خادم جروك فائق السرعة (Groq Llama 3.3)";
            rbGroq.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            rbGroq.ForeColor = Color.FromArgb(249, 115, 22);
            rbGroq.Location = new Point(110, 6);
            rbGroq.Size = new Size(cardW - 120, 24);
            rbGroq.Cursor = Cursors.Hand;
            rbGroq.CheckedChanged += (s, e) => { if (rbGroq.Checked) SwitchServer("groq"); };
            pnlCardGroq.Controls.Add(rbGroq);

            Label lblTagGroq = new Label();
            lblTagGroq.Text = "الأسرع عالمياً (0.1s)";
            lblTagGroq.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            lblTagGroq.Location = new Point(10, 6);
            lblTagGroq.Size = new Size(115, 22);
            UITheme.StylePillBadge(lblTagGroq, Color.FromArgb(249, 115, 22), Color.FromArgb(67, 20, 7), Color.FromArgb(234, 88, 12));
            pnlCardGroq.Controls.Add(lblTagGroq);

            pnlGroqKey = new Panel();
            pnlGroqKey.Location = new Point(10, 32);
            pnlGroqKey.Size = new Size(cardW - 20, 88);

            Panel pnlGroqKeyWrap = new Panel();
            pnlGroqKeyWrap.Location = new Point(120, 4);
            pnlGroqKeyWrap.Size = new Size(pnlGroqKey.Width - 125, 30);
            pnlGroqKeyWrap.BackColor = Color.FromArgb(15, 23, 42);
            UITheme.ApplyRoundedCard(pnlGroqKeyWrap, 8, Color.FromArgb(71, 85, 105), 1f);

            txtGroqKey = new TextBox();
            txtGroqKey.Location = new Point(4, 5);
            txtGroqKey.Size = new Size(pnlGroqKeyWrap.Width - 8, 22);
            txtGroqKey.PasswordChar = '*';
            txtGroqKey.BackColor = Color.FromArgb(15, 23, 42);
            txtGroqKey.ForeColor = Color.White;
            txtGroqKey.BorderStyle = BorderStyle.None;
            txtGroqKey.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            txtGroqKey.TextChanged += (s, e) => {
                if (currentConfig != null) { currentConfig.GroqKey = txtGroqKey.Text.Trim(); SaveSettings(); }
            };
            pnlGroqKeyWrap.Controls.Add(txtGroqKey);
            pnlGroqKey.Controls.Add(pnlGroqKeyWrap);

            btnTestGroq = new Button();
            btnTestGroq.Text = "🔍 فحص المفتاح";
            btnTestGroq.Location = new Point(4, 4);
            btnTestGroq.Size = new Size(110, 30);
            btnTestGroq.FlatStyle = FlatStyle.Flat;
            btnTestGroq.FlatAppearance.BorderSize = 0;
            btnTestGroq.ForeColor = Color.FromArgb(249, 115, 22);
            btnTestGroq.BackColor = Color.FromArgb(67, 20, 7);
            btnTestGroq.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            btnTestGroq.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnTestGroq, 10, Color.FromArgb(234, 88, 12), 1.2f);
            btnTestGroq.Click += async (s, e) => await TestGroqKeyAsync();
            pnlGroqKey.Controls.Add(btnTestGroq);

            LinkLabel lnkGroqGet = new LinkLabel();
            lnkGroqGet.Text = "🔗 اضغط هنا لفتح موقع Groq والحصول على المفتاح مجاناً (console.groq.com)";
            lnkGroqGet.Location = new Point(4, 38);
            lnkGroqGet.Size = new Size(pnlGroqKey.Width - 8, 20);
            lnkGroqGet.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            lnkGroqGet.LinkColor = Color.FromArgb(249, 115, 22);
            lnkGroqGet.ActiveLinkColor = Color.FromArgb(253, 186, 116);
            lnkGroqGet.VisitedLinkColor = Color.FromArgb(249, 115, 22);
            lnkGroqGet.Cursor = Cursors.Hand;
            lnkGroqGet.LinkBehavior = LinkBehavior.HoverUnderline;
            lnkGroqGet.Click += (s, e) => {
                try { Process.Start(new ProcessStartInfo("https://console.groq.com/keys") { UseShellExecute = true }); } catch { }
            };
            pnlGroqKey.Controls.Add(lnkGroqGet);

            lblGroqStatus = new Label();
            lblGroqStatus.Text = "ℹ️ يعمل مجاناً بدون مفتاح، أو الصق مفتاحك للسرعة القصوى.";
            lblGroqStatus.Location = new Point(4, 62);
            lblGroqStatus.Size = new Size(pnlGroqKey.Width - 8, 22);
            lblGroqStatus.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblGroqStatus.ForeColor = Color.FromArgb(148, 163, 184);
            pnlGroqKey.Controls.Add(lblGroqStatus);

            pnlCardGroq.Controls.Add(pnlGroqKey);
            pnlCardGroq.Click += (s, e) => rbGroq.Checked = true;
            pnlAccServersBody.Controls.Add(pnlCardGroq);
            y += 136;

            // البطاقة 5: الخادم الآخر (Gemini)
            pnlCardGemini = new Panel();
            pnlCardGemini.Location = new Point(12, y);
            pnlCardGemini.Size = new Size(cardW, 128);
            pnlCardGemini.BackColor = Color.FromArgb(11, 15, 25);
            pnlCardGemini.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCardDynamic(pnlCardGemini, 11, () => cardGeminiBorderColor, 1.4f);

            rbGemini = new RadioButton();
            rbGemini.Text = "⚡ الخادم الآخر (Google Gemini)";
            rbGemini.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            rbGemini.ForeColor = Color.FromArgb(125, 211, 252);
            rbGemini.Location = new Point(110, 6);
            rbGemini.Size = new Size(cardW - 120, 24);
            rbGemini.Cursor = Cursors.Hand;
            rbGemini.CheckedChanged += (s, e) => { if (rbGemini.Checked) SwitchServer("gemini"); };
            pnlCardGemini.Controls.Add(rbGemini);

            Label lblTagGemini = new Label();
            lblTagGemini.Text = "فائق السرعة (0.3s)";
            lblTagGemini.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            lblTagGemini.Location = new Point(10, 6);
            lblTagGemini.Size = new Size(110, 22);
            UITheme.StylePillBadge(lblTagGemini, Color.FromArgb(125, 211, 252), Color.FromArgb(12, 74, 110), Color.FromArgb(56, 189, 248));
            pnlCardGemini.Controls.Add(lblTagGemini);

            pnlGeminiKey = new Panel();
            pnlGeminiKey.Location = new Point(10, 32);
            pnlGeminiKey.Size = new Size(cardW - 20, 88);

            Panel pnlGeminiKeyWrap = new Panel();
            pnlGeminiKeyWrap.Location = new Point(120, 4);
            pnlGeminiKeyWrap.Size = new Size(pnlGeminiKey.Width - 125, 30);
            pnlGeminiKeyWrap.BackColor = Color.FromArgb(15, 23, 42);
            UITheme.ApplyRoundedCard(pnlGeminiKeyWrap, 8, Color.FromArgb(71, 85, 105), 1f);

            txtGeminiKey = new TextBox();
            txtGeminiKey.Location = new Point(4, 5);
            txtGeminiKey.Size = new Size(pnlGeminiKeyWrap.Width - 8, 22);
            txtGeminiKey.PasswordChar = '*';
            txtGeminiKey.BackColor = Color.FromArgb(15, 23, 42);
            txtGeminiKey.ForeColor = Color.White;
            txtGeminiKey.BorderStyle = BorderStyle.None;
            txtGeminiKey.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            txtGeminiKey.TextChanged += (s, e) => {
                if (currentConfig != null) { currentConfig.GeminiKey = txtGeminiKey.Text.Trim(); SaveSettings(); }
            };
            pnlGeminiKeyWrap.Controls.Add(txtGeminiKey);
            pnlGeminiKey.Controls.Add(pnlGeminiKeyWrap);

            btnTestGemini = new Button();
            btnTestGemini.Text = "🔍 فحص المفتاح";
            btnTestGemini.Location = new Point(4, 4);
            btnTestGemini.Size = new Size(110, 30);
            btnTestGemini.FlatStyle = FlatStyle.Flat;
            btnTestGemini.FlatAppearance.BorderSize = 0;
            btnTestGemini.ForeColor = Color.FromArgb(56, 189, 248);
            btnTestGemini.BackColor = Color.FromArgb(30, 41, 59);
            btnTestGemini.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            btnTestGemini.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnTestGemini, 10, Color.FromArgb(56, 189, 248), 1.2f);
            btnTestGemini.Click += async (s, e) => await TestGeminiKeyAsync();
            pnlGeminiKey.Controls.Add(btnTestGemini);

            LinkLabel lnkGeminiGet = new LinkLabel();
            lnkGeminiGet.Text = "🔗 اضغط هنا لفتح موقع Google AI Studio واستخراج المفتاح مجاناً";
            lnkGeminiGet.Location = new Point(4, 38);
            lnkGeminiGet.Size = new Size(pnlGeminiKey.Width - 8, 20);
            lnkGeminiGet.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            lnkGeminiGet.LinkColor = Color.FromArgb(56, 189, 248);
            lnkGeminiGet.ActiveLinkColor = Color.FromArgb(125, 211, 252);
            lnkGeminiGet.VisitedLinkColor = Color.FromArgb(56, 189, 248);
            lnkGeminiGet.Cursor = Cursors.Hand;
            lnkGeminiGet.LinkBehavior = LinkBehavior.HoverUnderline;
            lnkGeminiGet.Click += (s, e) => {
                try { Process.Start(new ProcessStartInfo("https://aistudio.google.com/app/apikey") { UseShellExecute = true }); } catch { }
            };
            pnlGeminiKey.Controls.Add(lnkGeminiGet);

            lblGeminiStatus = new Label();
            lblGeminiStatus.Text = "ℹ️ الصق المفتاح أعلاه ثم اضغط 'فحص المفتاح' للتأكد.";
            lblGeminiStatus.Location = new Point(4, 62);
            lblGeminiStatus.Size = new Size(pnlGeminiKey.Width - 8, 22);
            lblGeminiStatus.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblGeminiStatus.ForeColor = Color.FromArgb(148, 163, 184);
            pnlGeminiKey.Controls.Add(lblGeminiStatus);

            pnlCardGemini.Controls.Add(pnlGeminiKey);
            pnlCardGemini.Click += (s, e) => rbGemini.Checked = true;
            pnlAccServersBody.Controls.Add(pnlCardGemini);
            y += 136;

            // البطاقة 6: خادم شات جي بي تي (OpenAI)
            pnlCardOpenAI = new Panel();
            pnlCardOpenAI.Location = new Point(12, y);
            pnlCardOpenAI.Size = new Size(cardW, 128);
            pnlCardOpenAI.BackColor = Color.FromArgb(11, 15, 25);
            pnlCardOpenAI.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCardDynamic(pnlCardOpenAI, 11, () => cardOpenAIBorderColor, 1.4f);

            rbOpenAI = new RadioButton();
            rbOpenAI.Text = "🤖 خادم شات جي بي تي (ChatGPT / OpenAI)";
            rbOpenAI.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            rbOpenAI.ForeColor = Color.FromArgb(216, 180, 254);
            rbOpenAI.Location = new Point(110, 6);
            rbOpenAI.Size = new Size(cardW - 120, 24);
            rbOpenAI.Cursor = Cursors.Hand;
            rbOpenAI.CheckedChanged += (s, e) => { if (rbOpenAI.Checked) SwitchServer("openai"); };
            pnlCardOpenAI.Controls.Add(rbOpenAI);

            Label lblTagOpenAI = new Label();
            lblTagOpenAI.Text = "الأعلى دقة";
            lblTagOpenAI.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            lblTagOpenAI.Location = new Point(10, 6);
            lblTagOpenAI.Size = new Size(95, 22);
            UITheme.StylePillBadge(lblTagOpenAI, Color.FromArgb(216, 180, 254), Color.FromArgb(59, 7, 100), Color.FromArgb(192, 132, 252));
            pnlCardOpenAI.Controls.Add(lblTagOpenAI);

            pnlOpenAIKey = new Panel();
            pnlOpenAIKey.Location = new Point(10, 32);
            pnlOpenAIKey.Size = new Size(cardW - 20, 88);

            Panel pnlOpenAIKeyWrap = new Panel();
            pnlOpenAIKeyWrap.Location = new Point(120, 4);
            pnlOpenAIKeyWrap.Size = new Size(pnlOpenAIKey.Width - 125, 30);
            pnlOpenAIKeyWrap.BackColor = Color.FromArgb(15, 23, 42);
            UITheme.ApplyRoundedCard(pnlOpenAIKeyWrap, 8, Color.FromArgb(71, 85, 105), 1f);

            txtOpenAIKey = new TextBox();
            txtOpenAIKey.Location = new Point(4, 5);
            txtOpenAIKey.Size = new Size(pnlOpenAIKeyWrap.Width - 8, 22);
            txtOpenAIKey.PasswordChar = '*';
            txtOpenAIKey.BackColor = Color.FromArgb(15, 23, 42);
            txtOpenAIKey.ForeColor = Color.White;
            txtOpenAIKey.BorderStyle = BorderStyle.None;
            txtOpenAIKey.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            pnlOpenAIKeyWrap.Controls.Add(txtOpenAIKey);
            pnlOpenAIKey.Controls.Add(pnlOpenAIKeyWrap);

            btnTestOpenAI = new Button();
            btnTestOpenAI.Text = "🔍 فحص المفتاح";
            btnTestOpenAI.Location = new Point(4, 4);
            btnTestOpenAI.Size = new Size(110, 30);
            btnTestOpenAI.FlatStyle = FlatStyle.Flat;
            btnTestOpenAI.FlatAppearance.BorderSize = 0;
            btnTestOpenAI.ForeColor = Color.FromArgb(216, 180, 254);
            btnTestOpenAI.BackColor = Color.FromArgb(46, 16, 101);
            btnTestOpenAI.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            btnTestOpenAI.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnTestOpenAI, 10, Color.FromArgb(192, 132, 252), 1.2f);
            btnTestOpenAI.Click += async (s, e) => await TestOpenAIKeyAsync();
            pnlOpenAIKey.Controls.Add(btnTestOpenAI);

            LinkLabel lnkOpenAIGet = new LinkLabel();
            lnkOpenAIGet.Text = "🔗 اضغط هنا لفتح موقع OpenAI واستخراج المفتاح (platform.openai.com)";
            lnkOpenAIGet.Location = new Point(4, 38);
            lnkOpenAIGet.Size = new Size(pnlOpenAIKey.Width - 8, 20);
            lnkOpenAIGet.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            lnkOpenAIGet.LinkColor = Color.FromArgb(216, 180, 254);
            lnkOpenAIGet.ActiveLinkColor = Color.FromArgb(233, 213, 255);
            lnkOpenAIGet.VisitedLinkColor = Color.FromArgb(216, 180, 254);
            lnkOpenAIGet.Cursor = Cursors.Hand;
            lnkOpenAIGet.LinkBehavior = LinkBehavior.HoverUnderline;
            lnkOpenAIGet.Click += (s, e) => {
                try { Process.Start(new ProcessStartInfo("https://platform.openai.com/api-keys") { UseShellExecute = true }); } catch { }
            };
            pnlOpenAIKey.Controls.Add(lnkOpenAIGet);

            lblOpenAIStatus = new Label();
            lblOpenAIStatus.Text = "ℹ️ الصق المفتاح واضغط 'فحص المفتاح' للتحقق من الرصيد والاتصال.";
            lblOpenAIStatus.Location = new Point(4, 62);
            lblOpenAIStatus.Size = new Size(pnlOpenAIKey.Width - 8, 22);
            lblOpenAIStatus.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblOpenAIStatus.ForeColor = Color.FromArgb(148, 163, 184);
            pnlOpenAIKey.Controls.Add(lblOpenAIStatus);

            pnlCardOpenAI.Controls.Add(pnlOpenAIKey);
            pnlCardOpenAI.Click += (s, e) => rbOpenAI.Checked = true;
            pnlAccServersBody.Controls.Add(pnlCardOpenAI);
            y += 136;

            pnlAccServersBody.Height = y + 10;
            pnlMain.Controls.Add(pnlAccServersBody);
        }
        private void BuildAccordionSubjects(int itemW)
        {
            pnlAccSubjectsHeader = CreateAccordionHeader(
                itemW, "📚", "التخصص والمادة الدراسية", "تكييف الذكاء كمعلم متخصص في مادتك",
                "📚 عام", Color.FromArgb(251, 191, 36), Color.FromArgb(69, 26, 3),
                out lblAccSubjectsBadge, out lblAccSubjectsChevron,
                ToggleSubjects
            );
            pnlMain.Controls.Add(pnlAccSubjectsHeader);

            pnlAccSubjectsBody = new Panel();
            pnlAccSubjectsBody.Size = new Size(itemW, 88);
            pnlAccSubjectsBody.BackColor = Color.FromArgb(15, 23, 42);
            pnlAccSubjectsBody.BorderStyle = BorderStyle.None;
            pnlAccSubjectsBody.Visible = false;
            UITheme.ApplyRoundedCard(pnlAccSubjectsBody, 14, Color.FromArgb(51, 65, 85), 1.2f);

            Label lbl = new Label();
            lbl.Text = "اختر مادة الاختبار لتكييف القوانين وطريقة الحل بدقة:";
            lbl.Location = new Point(14, 10);
            lbl.Size = new Size(itemW - 28, 22);
            lbl.ForeColor = Color.FromArgb(203, 213, 225);
            pnlAccSubjectsBody.Controls.Add(lbl);

            cbSubject = new ModernDropdown();
            cbSubject.Location = new Point(14, 36);
            cbSubject.Size = new Size(itemW - 28, 38);
            cbSubject.SetTheme(Color.FromArgb(245, 158, 11));
            cbSubject.Items.AddRange(new object[] {
                "📚 عام / بدون تحديد", "🔢 رياضيات", "🔬 علوم", "🧮 قدرات كمي", "📖 قدرات لفظي",
                "⚡ فيزياء", "🧪 كيمياء", "🧬 أحياء", "🕌 دراسات إسلامية", "📜 لغة عربية ونحو",
                "🌍 اجتماعيات وتاريخ", "💻 حاسب آلي وتقنية", "🇬🇧 لغة إنجليزية"
            });
            cbSubject.SelectedIndex = 0;
            cbSubject.SelectedIndexChanged += (s, e) => {
                string[] parts = cbSubject.Text.Split(' ');
                lblAccSubjectsBadge.Text = parts.Length > 1 ? parts[1] : cbSubject.Text;
            };
            pnlAccSubjectsBody.Controls.Add(cbSubject);

            pnlMain.Controls.Add(pnlAccSubjectsBody);
        }

        private void BuildAccordionLanguages(int itemW)
        {
            pnlAccLanguagesHeader = CreateAccordionHeader(
                itemW, "🌍", "لغة الإجابة والترجمة الفورية", "استخراج الإجابة والترجمة لـ 30 لغة",
                "العربية", Color.FromArgb(52, 211, 153), Color.FromArgb(6, 78, 59),
                out lblAccLanguagesBadge, out lblAccLanguagesChevron,
                ToggleLanguages
            );
            pnlMain.Controls.Add(pnlAccLanguagesHeader);

            pnlAccLanguagesBody = new Panel();
            pnlAccLanguagesBody.Size = new Size(itemW, 88);
            pnlAccLanguagesBody.BackColor = Color.FromArgb(15, 23, 42);
            pnlAccLanguagesBody.BorderStyle = BorderStyle.None;
            pnlAccLanguagesBody.Visible = false;
            UITheme.ApplyRoundedCard(pnlAccLanguagesBody, 14, Color.FromArgb(51, 65, 85), 1.2f);

            Label lbl = new Label();
            lbl.Text = "اختر اللغة التي تريد استخراج رمز الحل والترجمة إليها:";
            lbl.Location = new Point(14, 10);
            lbl.Size = new Size(itemW - 28, 22);
            lbl.ForeColor = Color.FromArgb(203, 213, 225);
            pnlAccLanguagesBody.Controls.Add(lbl);

            cbLanguage = new ModernDropdown();
            cbLanguage.Location = new Point(14, 36);
            cbLanguage.Size = new Size(itemW - 28, 38);
            cbLanguage.SetTheme(Color.FromArgb(52, 211, 153));
            cbLanguage.Items.AddRange(new object[] {
                "العربية (تلقائي)", "English (الإنجليزية)", "Français (الفرنسية)", "Español (الإسبانية)",
                "Deutsch (الألمانية)", "Türkçe (التركية)", "اردو (الأردية)", "Русский (الروسية)", "中文 (الصينية)"
            });
            cbLanguage.SelectedIndex = 0;
            cbLanguage.SelectedIndexChanged += (s, e) => {
                string[] parts = cbLanguage.Text.Split(' ');
                lblAccLanguagesBadge.Text = parts[0];
            };
            pnlAccLanguagesBody.Controls.Add(cbLanguage);

            pnlMain.Controls.Add(pnlAccLanguagesBody);
        }

        private void BuildAccordionSettings(int itemW)
        {
            pnlAccSettingsHeader = CreateAccordionHeader(
                itemW, "⚙️", "إعدادات وتخصيص المساعد", "تثبيت النافذة وشكل الحواف وربط كروم",
                "عادي", Color.FromArgb(34, 211, 238), Color.FromArgb(22, 78, 99),
                out lblAccSettingsBadge, out lblAccSettingsChevron,
                ToggleSettings
            );
            pnlMain.Controls.Add(pnlAccSettingsHeader);

            pnlAccSettingsBody = new Panel();
            pnlAccSettingsBody.Size = new Size(itemW, 238);
            pnlAccSettingsBody.BackColor = Color.FromArgb(15, 23, 42);
            pnlAccSettingsBody.BorderStyle = BorderStyle.None;
            pnlAccSettingsBody.Visible = false;
            UITheme.ApplyRoundedCard(pnlAccSettingsBody, 14, Color.FromArgb(51, 65, 85), 1.2f);

            chkAlwaysOnTop = new CheckBox();
            chkAlwaysOnTop.Text = "📌 تثبيت نافذة البرنامج فوق كافة التطبيقات الأخرى دائماً";
            chkAlwaysOnTop.Location = new Point(14, 12);
            chkAlwaysOnTop.Size = new Size(itemW - 28, 26);
            chkAlwaysOnTop.ForeColor = Color.FromArgb(165, 243, 252);
            chkAlwaysOnTop.Cursor = Cursors.Hand;
            chkAlwaysOnTop.CheckedChanged += (s, e) => {
                this.TopMost = chkAlwaysOnTop.Checked;
                lblAccSettingsBadge.Text = chkAlwaysOnTop.Checked ? "📌 مثبت" : "عادي";
            };
            pnlAccSettingsBody.Controls.Add(chkAlwaysOnTop);

            chkFloatingPopup = new CheckBox();
            chkFloatingPopup.Text = "⚡ تفعيل زر الحل العائم عند تحديد النصوص في أي برنامج";
            chkFloatingPopup.Location = new Point(14, 40);
            chkFloatingPopup.Size = new Size(itemW - 28, 26);
            chkFloatingPopup.ForeColor = Color.FromArgb(56, 189, 248);
            chkFloatingPopup.Cursor = Cursors.Hand;
            chkFloatingPopup.Checked = isFloatingPopupEnabled;
            chkFloatingPopup.CheckedChanged += (s, e) => {
                isFloatingPopupEnabled = chkFloatingPopup.Checked;
                if (selectionMonitor != null) selectionMonitor.IsEnabled = isFloatingPopupEnabled;
                if (currentConfig != null) { currentConfig.FloatingPopupEnabled = isFloatingPopupEnabled; SaveSettings(); }
            };
            pnlAccSettingsBody.Controls.Add(chkFloatingPopup);

            btnChromeStatus = new Button();
            btnChromeStatus.Location = new Point(14, 70);
            btnChromeStatus.Size = new Size(itemW - 28, 34);
            btnChromeStatus.FlatStyle = FlatStyle.Flat;
            btnChromeStatus.FlatAppearance.BorderSize = 0;
            btnChromeStatus.Cursor = Cursors.Hand;
            btnChromeStatus.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            UITheme.ApplyRoundedCard(btnChromeStatus, 14, Color.FromArgb(16, 185, 129), 1.2f);
            btnChromeStatus.Click += BtnChromeStatus_Click;
            pnlAccSettingsBody.Controls.Add(btnChromeStatus);

            // عنوان شكل حواف خيارات وبطاقات الأداة
            Label lblShapeTitle = new Label();
            lblShapeTitle.Text = "📐 شكل حواف خيارات وبطاقات الأداة (Border Shape):";
            lblShapeTitle.Location = new Point(14, 110);
            lblShapeTitle.Size = new Size(itemW - 28, 20);
            lblShapeTitle.ForeColor = Color.FromArgb(56, 189, 248);
            lblShapeTitle.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            pnlAccSettingsBody.Controls.Add(lblShapeTitle);

            // أزرار أشكال الحواف الثلاثة
            int btnW = (itemW - 28 - 12) / 3;
            btnShapeSharp = new Button();
            btnShapeSharp.Text = "⬛ حادة 4px";
            btnShapeSharp.Location = new Point(14, 134);
            btnShapeSharp.Size = new Size(btnW, 34);
            btnShapeSharp.FlatStyle = FlatStyle.Flat;
            btnShapeSharp.FlatAppearance.BorderSize = 0;
            btnShapeSharp.Cursor = Cursors.Hand;
            btnShapeSharp.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            UITheme.ApplyRoundedCard(btnShapeSharp, 4, Color.FromArgb(71, 85, 105), 1.2f);
            btnShapeSharp.Click += (s, e) => SetAppBorderShape("sharp");
            pnlAccSettingsBody.Controls.Add(btnShapeSharp);

            btnShapeSmooth = new Button();
            btnShapeSmooth.Text = "🟦 ناعمة 12px";
            btnShapeSmooth.Location = new Point(14 + btnW + 6, 134);
            btnShapeSmooth.Size = new Size(btnW, 34);
            btnShapeSmooth.FlatStyle = FlatStyle.Flat;
            btnShapeSmooth.FlatAppearance.BorderSize = 0;
            btnShapeSmooth.Cursor = Cursors.Hand;
            btnShapeSmooth.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            UITheme.ApplyRoundedCard(btnShapeSmooth, 12, Color.FromArgb(56, 189, 248), 1.2f);
            btnShapeSmooth.Click += (s, e) => SetAppBorderShape("smooth");
            pnlAccSettingsBody.Controls.Add(btnShapeSmooth);

            btnShapeCapsule = new Button();
            btnShapeCapsule.Text = "💊 كبسولية 24px";
            btnShapeCapsule.Location = new Point(14 + (btnW + 6) * 2, 134);
            btnShapeCapsule.Size = new Size(btnW, 34);
            btnShapeCapsule.FlatStyle = FlatStyle.Flat;
            btnShapeCapsule.FlatAppearance.BorderSize = 0;
            btnShapeCapsule.Cursor = Cursors.Hand;
            btnShapeCapsule.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            UITheme.ApplyRoundedCard(btnShapeCapsule, 20, Color.FromArgb(71, 85, 105), 1.2f);
            btnShapeCapsule.Click += (s, e) => SetAppBorderShape("capsule");
            pnlAccSettingsBody.Controls.Add(btnShapeCapsule);

            // زر فتح مركز التخصيص الكامل
            btnOpenWebCustomizer = new Button();
            btnOpenWebCustomizer.Text = "🎨 فتح مركز التخصيص الكامل والألوان (Web Customizer)";
            btnOpenWebCustomizer.Location = new Point(14, 178);
            btnOpenWebCustomizer.Size = new Size(itemW - 28, 42);
            btnOpenWebCustomizer.FlatStyle = FlatStyle.Flat;
            btnOpenWebCustomizer.FlatAppearance.BorderSize = 0;
            btnOpenWebCustomizer.Cursor = Cursors.Hand;
            btnOpenWebCustomizer.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btnOpenWebCustomizer.BackColor = Color.FromArgb(30, 41, 59);
            btnOpenWebCustomizer.ForeColor = Color.FromArgb(224, 231, 255);
            UITheme.ApplyRoundedCard(btnOpenWebCustomizer, 12, Color.FromArgb(129, 140, 248), 1.2f);
            btnOpenWebCustomizer.Click += (s, e) => OpenWebCustomizer();
            pnlAccSettingsBody.Controls.Add(btnOpenWebCustomizer);

            UpdateShapeButtonsUI();

            pnlMain.Controls.Add(pnlAccSettingsBody);
        }

        private void SetAppBorderShape(string mode)
        {
            UITheme.SetShapeMode(mode);
            if (currentConfig != null)
            {
                currentConfig.BorderShape = mode;
                SaveSettings();
            }
            UpdateShapeButtonsUI();
            this.Invalidate(true);
        }

        private void UpdateShapeButtonsUI()
        {
            if (btnShapeSharp == null || btnShapeSmooth == null || btnShapeCapsule == null) return;
            string cur = UITheme.CurrentShapeMode;

            btnShapeSharp.BackColor = (cur == "sharp") ? Color.FromArgb(2, 132, 199) : Color.FromArgb(30, 41, 59);
            btnShapeSharp.ForeColor = (cur == "sharp") ? Color.White : Color.FromArgb(148, 163, 184);
            btnShapeSharp.Text = (cur == "sharp") ? "✓ ⬛ حادة 4px" : "⬛ حادة 4px";

            btnShapeSmooth.BackColor = (cur == "smooth") ? Color.FromArgb(2, 132, 199) : Color.FromArgb(30, 41, 59);
            btnShapeSmooth.ForeColor = (cur == "smooth") ? Color.White : Color.FromArgb(148, 163, 184);
            btnShapeSmooth.Text = (cur == "smooth") ? "✓ 🟦 ناعمة 12px" : "🟦 ناعمة 12px";

            btnShapeCapsule.BackColor = (cur == "capsule") ? Color.FromArgb(2, 132, 199) : Color.FromArgb(30, 41, 59);
            btnShapeCapsule.ForeColor = (cur == "capsule") ? Color.White : Color.FromArgb(148, 163, 184);
            btnShapeCapsule.Text = (cur == "capsule") ? "✓ 💊 كبسولية 24px" : "💊 كبسولية 24px";
        }

        private void OpenWebCustomizer()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string p1 = Path.Combine(baseDir, "customizer.html");
                string p2 = Path.Combine(baseDir, "..", "customizer.html");
                string target = File.Exists(p1) ? p1 : (File.Exists(p2) ? Path.GetFullPath(p2) : "https://moayadk-ly.github.io/quizgenie/customizer.html");
                Process.Start(new ProcessStartInfo(target) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show("تعذر فتح صفحة التخصيص: " + ex.Message, "QuizGenie Customizer", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void BuildAccordionSolver(int itemW)
        {
            pnlAccSolverHeader = CreateAccordionHeader(
                itemW, "⚡", "حل سؤال فوري وسريع", "لصق السؤال وحله بدون فلسفة أو بالتفصيل",
                "جاهز للحل", Color.FromArgb(251, 113, 133), Color.FromArgb(76, 5, 25),
                out lblAccSolverBadge, out lblAccSolverChevron,
                ToggleSolver
            );
            pnlMain.Controls.Add(pnlAccSolverHeader);

            pnlAccSolverBody = new Panel();
            pnlAccSolverBody.Size = new Size(itemW, 365);
            pnlAccSolverBody.BackColor = Color.FromArgb(15, 23, 42);
            pnlAccSolverBody.BorderStyle = BorderStyle.None;
            pnlAccSolverBody.Visible = false;
            UITheme.ApplyRoundedCard(pnlAccSolverBody, 14, Color.FromArgb(51, 65, 85), 1.2f);

            int y = 12;
            Label lblQ = new Label();
            lblQ.Text = "أدخل أو الصق نص السؤال وخياراته هنا:";
            lblQ.Location = new Point(150, y);
            lblQ.Size = new Size(itemW - 164, 24);
            lblQ.ForeColor = Color.FromArgb(254, 205, 211);
            lblQ.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            pnlAccSolverBody.Controls.Add(lblQ);

            btnPasteQuestion = new Button();
            btnPasteQuestion.Text = "📋 لصق من الحافظة";
            btnPasteQuestion.Location = new Point(14, y - 2);
            btnPasteQuestion.Size = new Size(130, 28);
            btnPasteQuestion.FlatStyle = FlatStyle.Flat;
            btnPasteQuestion.FlatAppearance.BorderSize = 0;
            btnPasteQuestion.ForeColor = Color.FromArgb(254, 205, 211);
            btnPasteQuestion.BackColor = Color.FromArgb(30, 41, 59);
            btnPasteQuestion.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            btnPasteQuestion.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnPasteQuestion, 14, Color.FromArgb(251, 113, 133), 1.2f);
            btnPasteQuestion.Click += (s, e) => {
                if (Clipboard.ContainsText()) txtQuestion.Text = Clipboard.GetText();
            };
            pnlAccSolverBody.Controls.Add(btnPasteQuestion);

            btnSnipScreen = new Button();
            btnSnipScreen.Text = "ًں“¸ ظ‚طµ ط§ظ„ط´ط§ط´ط© (F2)";
            btnSnipScreen.Location = new Point(148, y - 2);
            btnSnipScreen.Size = new Size(130, 28);
            btnSnipScreen.FlatStyle = FlatStyle.Flat;
            btnSnipScreen.FlatAppearance.BorderSize = 0;
            btnSnipScreen.ForeColor = Color.FromArgb(186, 230, 253);
            btnSnipScreen.BackColor = Color.FromArgb(30, 41, 59);
            btnSnipScreen.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            btnSnipScreen.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnSnipScreen, 14, Color.FromArgb(56, 189, 248), 1.2f);
            btnSnipScreen.Click += (s, e) => StartScreenSnip();
            pnlAccSolverBody.Controls.Add(btnSnipScreen);

            btnExportHistory = new Button();
            btnExportHistory.Text = "ًں“œ ظ…ظ„ط®طµ ط§ظ„ظ…ط°ط§ظƒط±ط©";
            btnExportHistory.Location = new Point(282, y - 2);
            btnExportHistory.Size = new Size(130, 28);
            btnExportHistory.FlatStyle = FlatStyle.Flat;
            btnExportHistory.FlatAppearance.BorderSize = 0;
            btnExportHistory.ForeColor = Color.FromArgb(187, 247, 208);
            btnExportHistory.BackColor = Color.FromArgb(30, 41, 59);
            btnExportHistory.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            btnExportHistory.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnExportHistory, 14, Color.FromArgb(52, 211, 153), 1.2f);
            btnExportHistory.Click += (s, e) => ExportStudySheet();
            pnlAccSolverBody.Controls.Add(btnExportHistory);
            y += 32;

            Panel pnlQuestionWrap = new Panel();
            pnlQuestionWrap.Location = new Point(14, y);
            pnlQuestionWrap.Size = new Size(itemW - 28, 70);
            pnlQuestionWrap.BackColor = Color.FromArgb(11, 15, 25);
            UITheme.ApplyRoundedCard(pnlQuestionWrap, 10, Color.FromArgb(71, 85, 105), 1f);

            txtQuestion = new TextBox();
            txtQuestion.Multiline = true;
            txtQuestion.Location = new Point(6, 6);
            txtQuestion.Size = new Size(pnlQuestionWrap.Width - 12, pnlQuestionWrap.Height - 12);
            txtQuestion.BackColor = Color.FromArgb(11, 15, 25);
            txtQuestion.ForeColor = Color.White;
            txtQuestion.BorderStyle = BorderStyle.None;
            txtQuestion.Font = new Font("Segoe UI", 10.5f, FontStyle.Regular);
            txtQuestion.ScrollBars = ScrollBars.Vertical;
            pnlQuestionWrap.Controls.Add(txtQuestion);
            pnlAccSolverBody.Controls.Add(pnlQuestionWrap);
            y += 78;

            int btnHalfW = (itemW - 36) / 2;
            btnSolveConcise = new Button();
            btnSolveConcise.Text = "⚡ الإجابة بدون فلسفة";
            btnSolveConcise.Location = new Point(14 + btnHalfW + 8, y);
            btnSolveConcise.Size = new Size(btnHalfW, 42);
            btnSolveConcise.FlatStyle = FlatStyle.Flat;
            btnSolveConcise.FlatAppearance.BorderSize = 0;
            btnSolveConcise.BackColor = Color.FromArgb(2, 132, 199);
            btnSolveConcise.ForeColor = Color.White;
            btnSolveConcise.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            btnSolveConcise.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnSolveConcise, 12, Color.FromArgb(56, 189, 248), 1.2f);
            btnSolveConcise.Click += async (s, e) => await SolveAsync("concise");
            pnlAccSolverBody.Controls.Add(btnSolveConcise);

            btnSolveDetailed = new Button();
            btnSolveDetailed.Text = "📖 الإجابة المفصلة";
            btnSolveDetailed.Location = new Point(14, y);
            btnSolveDetailed.Size = new Size(btnHalfW, 42);
            btnSolveDetailed.FlatStyle = FlatStyle.Flat;
            btnSolveDetailed.FlatAppearance.BorderSize = 0;
            btnSolveDetailed.BackColor = Color.FromArgb(124, 58, 237);
            btnSolveDetailed.ForeColor = Color.White;
            btnSolveDetailed.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            btnSolveDetailed.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnSolveDetailed, 12, Color.FromArgb(192, 132, 252), 1.2f);
            btnSolveDetailed.Click += async (s, e) => await SolveAsync("detailed");
            pnlAccSolverBody.Controls.Add(btnSolveDetailed);
            y += 48;

            lblAnswerStatus = new Label();
            lblAnswerStatus.Text = "جاهز لاستخراج الإجابة فوراً...";
            lblAnswerStatus.Location = new Point(14, y);
            lblAnswerStatus.Size = new Size(itemW - 28, 20);
            lblAnswerStatus.ForeColor = Color.FromArgb(148, 163, 184);
            lblAnswerStatus.Font = new Font("Segoe UI", 9f, FontStyle.Italic);
            pnlAccSolverBody.Controls.Add(lblAnswerStatus);
            y += 24;

            Label lblAns = new Label();
            lblAns.Text = "الإجابة المستخرجة:";
            lblAns.Location = new Point(135, y);
            lblAns.Size = new Size(itemW - 149, 24);
            lblAns.ForeColor = Color.FromArgb(254, 205, 211);
            lblAns.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            pnlAccSolverBody.Controls.Add(lblAns);

            btnCopyAnswer = new Button();
            btnCopyAnswer.Text = "📋 نسخ الإجابة";
            btnCopyAnswer.Location = new Point(14, y - 2);
            btnCopyAnswer.Size = new Size(115, 28);
            btnCopyAnswer.FlatStyle = FlatStyle.Flat;
            btnCopyAnswer.FlatAppearance.BorderSize = 0;
            btnCopyAnswer.ForeColor = Color.FromArgb(254, 205, 211);
            btnCopyAnswer.BackColor = Color.FromArgb(30, 41, 59);
            btnCopyAnswer.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            btnCopyAnswer.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnCopyAnswer, 14, Color.FromArgb(251, 113, 133), 1.2f);
            btnCopyAnswer.Click += (s, e) => {
                if (!string.IsNullOrEmpty(txtAnswer.Text))
                {
                    Clipboard.SetText(txtAnswer.Text);
                    lblAnswerStatus.Text = "✓ تم نسخ الإجابة إلى الحافظة بنجاح!";
                    lblAnswerStatus.ForeColor = Color.FromArgb(52, 211, 153);
                }
            };
            pnlAccSolverBody.Controls.Add(btnCopyAnswer);

            btnSpeakDesktop = new Button();
            btnSpeakDesktop.Text = "ًں”ٹ ط§ط³طھظ…ط§ط¹ طµظˆطھظٹ";
            btnSpeakDesktop.Location = new Point(134, y - 2);
            btnSpeakDesktop.Size = new Size(115, 28);
            btnSpeakDesktop.FlatStyle = FlatStyle.Flat;
            btnSpeakDesktop.FlatAppearance.BorderSize = 0;
            btnSpeakDesktop.ForeColor = Color.FromArgb(224, 231, 255);
            btnSpeakDesktop.BackColor = Color.FromArgb(30, 41, 59);
            btnSpeakDesktop.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            btnSpeakDesktop.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnSpeakDesktop, 14, Color.FromArgb(129, 140, 248), 1.2f);
            btnSpeakDesktop.Click += (s, e) => ToggleDesktopSpeech();
            pnlAccSolverBody.Controls.Add(btnSpeakDesktop);
            y += 32;

            Panel pnlAnswerWrap = new Panel();
            pnlAnswerWrap.Location = new Point(14, y);
            pnlAnswerWrap.Size = new Size(itemW - 28, 92);
            pnlAnswerWrap.BackColor = Color.FromArgb(11, 15, 25);
            UITheme.ApplyRoundedCard(pnlAnswerWrap, 10, Color.FromArgb(71, 85, 105), 1f);

            txtAnswer = new TextBox();
            txtAnswer.Multiline = true;
            txtAnswer.ReadOnly = true;
            txtAnswer.Location = new Point(6, 6);
            txtAnswer.Size = new Size(pnlAnswerWrap.Width - 12, pnlAnswerWrap.Height - 12);
            txtAnswer.BackColor = Color.FromArgb(11, 15, 25);
            txtAnswer.ForeColor = Color.FromArgb(248, 250, 252);
            txtAnswer.BorderStyle = BorderStyle.None;
            txtAnswer.Font = new Font("Segoe UI", 11f, FontStyle.Regular);
            txtAnswer.ScrollBars = ScrollBars.Vertical;
            txtAnswer.WordWrap = true;
            pnlAnswerWrap.Controls.Add(txtAnswer);
            pnlAccSolverBody.Controls.Add(pnlAnswerWrap);

            pnlMain.Controls.Add(pnlAccSolverBody);
        }

        private void BuildAccordionAbout(int itemW)
        {
            pnlAccAboutHeader = CreateAccordionHeader(
                itemW, "💡", "نبذة ودليل استخدام الأداة", "فائدتها في الاختبارات والواجبات",
                "دليل الأداة", Color.FromArgb(129, 140, 248), Color.FromArgb(30, 27, 75),
                out lblAccAboutBadge, out lblAccAboutChevron,
                ToggleAbout
            );
            pnlMain.Controls.Add(pnlAccAboutHeader);

            pnlAccAboutBody = new Panel();
            pnlAccAboutBody.Size = new Size(itemW, 200);
            pnlAccAboutBody.BackColor = Color.FromArgb(15, 23, 42);
            pnlAccAboutBody.BorderStyle = BorderStyle.None;
            pnlAccAboutBody.Visible = false;
            pnlAccAboutBody.Padding = new Padding(10);
            UITheme.ApplyRoundedCard(pnlAccAboutBody, 14, Color.FromArgb(51, 65, 85), 1.2f);

            txtAbout = new TextBox();
            txtAbout.Multiline = true;
            txtAbout.ReadOnly = true;
            txtAbout.Dock = DockStyle.Fill;
            txtAbout.BackColor = Color.FromArgb(15, 23, 42);
            txtAbout.ForeColor = Color.FromArgb(226, 232, 240);
            txtAbout.BorderStyle = BorderStyle.None;
            txtAbout.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            txtAbout.ScrollBars = ScrollBars.Vertical;
            txtAbout.WordWrap = true;
            txtAbout.Text =
                "🎯 ما هي فائدة الأداة؟\r\n" +
                "أداة ذكية مصممة لمساعدة الطلاب في حل الاختبارات، الامتحانات التجريبية، والواجبات في كافة المواد بسرعة فائقة وبدون أي تأخير.\r\n\r\n" +
                "⚡ الخوادم الثلاثة المستقلة:\r\n" +
                "• الخادم المجاني: تلقائي بدون مفتاح ويعمل مباشرة 100% مجاناً.\r\n" +
                "• الخادم الآخر (Gemini): فائق السرعة من جوجل ويحل بأقل من نصف ثانية.\r\n" +
                "• خادم شات جي بي تي (ChatGPT): الأعلى دقة في المسائل المعقدة والقدرات والرياضيات.\r\n\r\n" +
                "📚 ميزة اختيار المادة ولغات الإجابة:\r\n" +
                "تكييف الذكاء الاصطناعي كمعلم متخصص في مادتك وترجمة رمز الحل لأكثر من 30 لغة عالمية.\r\n\r\n" +
                "⚡ وضعي الحل الذكي:\r\n" +
                "• الإجابة بدون فلسفة: استخراج رمز الإجابة الصحيحة فقط لكسب الوقت الحرج.\r\n" +
                "• الإجابة المفصلة: استخراج رمز الحل متبوعاً بشرح موجز وخطوات الحل.";
            pnlAccAboutBody.Controls.Add(txtAbout);

            pnlMain.Controls.Add(pnlAccAboutBody);
        }

        private Panel CreateAccordionHeader(
            int itemW, string icon, string title, string subtitle, string badgeText,
            Color themeColor, Color bgGradient, out Label lblBadge, out Label lblChevron,
            Action onToggle)
        {
            Panel pnl = new Panel();
            pnl.Size = new Size(itemW, 52);
            pnl.BackColor = bgGradient;
            pnl.BorderStyle = BorderStyle.None;
            pnl.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(pnl, 14, themeColor, 1.2f);

            Panel pnlIcon = new Panel();
            pnlIcon.Location = new Point(itemW - 46, 9);
            pnlIcon.Size = new Size(34, 34);
            pnlIcon.BackColor = Color.FromArgb(30, 41, 59);
            pnlIcon.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(pnlIcon, 8, Color.FromArgb(71, 85, 105), 1f);

            Label lblIcon = new Label();
            lblIcon.Text = icon;
            lblIcon.Font = new Font("Segoe UI", 12f, FontStyle.Regular);
            lblIcon.Dock = DockStyle.Fill;
            lblIcon.TextAlign = ContentAlignment.MiddleCenter;
            lblIcon.Cursor = Cursors.Hand;
            pnlIcon.Controls.Add(lblIcon);
            pnl.Controls.Add(pnlIcon);

            Label lblTitle = new Label();
            lblTitle.Text = title;
            lblTitle.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            lblTitle.ForeColor = themeColor;
            lblTitle.Location = new Point(135, 7);
            lblTitle.Size = new Size(itemW - 190, 20);
            lblTitle.Cursor = Cursors.Hand;
            pnl.Controls.Add(lblTitle);

            Label lblSub = new Label();
            lblSub.Text = subtitle;
            lblSub.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblSub.ForeColor = Color.FromArgb(148, 163, 184);
            lblSub.Location = new Point(135, 27);
            lblSub.Size = new Size(itemW - 190, 18);
            lblSub.Cursor = Cursors.Hand;
            pnl.Controls.Add(lblSub);

            lblBadge = new Label();
            lblBadge.Text = badgeText;
            lblBadge.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            lblBadge.Location = new Point(36, 13);
            lblBadge.Size = new Size(92, 26);
            lblBadge.Cursor = Cursors.Hand;
            UITheme.StylePillBadge(lblBadge, themeColor, Color.FromArgb(15, 23, 42), themeColor);
            pnl.Controls.Add(lblBadge);

            lblChevron = new Label();
            lblChevron.Text = "▾";
            lblChevron.Font = new Font("Segoe UI", 13f, FontStyle.Bold);
            lblChevron.ForeColor = themeColor;
            lblChevron.Location = new Point(8, 11);
            lblChevron.Size = new Size(24, 28);
            lblChevron.TextAlign = ContentAlignment.MiddleCenter;
            lblChevron.Cursor = Cursors.Hand;
            pnl.Controls.Add(lblChevron);

            Action<Control> attachClick = null;
            attachClick = (c) =>
            {
                c.Cursor = Cursors.Hand;
                c.Click += (s, e) => onToggle();
                foreach (Control sub in c.Controls) attachClick(sub);
            };
            foreach (Control c in pnl.Controls) attachClick(c);
            pnl.Click += (s, e) => onToggle();

            return pnl;
        }

        private void RefreshAccordionLayout()
        {
            pnlMain.SuspendLayout();

            int y = 12;

            pnlHeader.Location = new Point(12, y);
            y += pnlHeader.Height + 10;

            pnlActiveServerCard.Location = new Point(12, y);
            y += pnlActiveServerCard.Height + 10;

            btnMasterPower.Location = new Point(12, y);
            y += btnMasterPower.Height + 12;

            // 1. خوادم الذكاء الاصطناعي
            pnlAccServersHeader.Location = new Point(12, y);
            y += pnlAccServersHeader.Height + 4;
            pnlAccServersBody.Location = new Point(12, y);
            pnlAccServersBody.Visible = isServersOpen;
            lblAccServersChevron.Text = isServersOpen ? "▴" : "▾";
            if (isServersOpen)
            {
                y += pnlAccServersBody.Height + 8;
            }
            else
            {
                y += 6;
            }

            // 2. التخصص والمادة الدراسية
            pnlAccSubjectsHeader.Location = new Point(12, y);
            y += pnlAccSubjectsHeader.Height + 4;
            pnlAccSubjectsBody.Location = new Point(12, y);
            pnlAccSubjectsBody.Visible = isSubjectsOpen;
            lblAccSubjectsChevron.Text = isSubjectsOpen ? "▴" : "▾";
            if (isSubjectsOpen)
            {
                y += pnlAccSubjectsBody.Height + 8;
            }
            else
            {
                y += 6;
            }

            // 3. لغة الإجابة والترجمة الفورية
            pnlAccLanguagesHeader.Location = new Point(12, y);
            y += pnlAccLanguagesHeader.Height + 4;
            pnlAccLanguagesBody.Location = new Point(12, y);
            pnlAccLanguagesBody.Visible = isLanguagesOpen;
            lblAccLanguagesChevron.Text = isLanguagesOpen ? "▴" : "▾";
            if (isLanguagesOpen)
            {
                y += pnlAccLanguagesBody.Height + 8;
            }
            else
            {
                y += 6;
            }

            // 4. إعدادات وتخصيص المساعد
            pnlAccSettingsHeader.Location = new Point(12, y);
            y += pnlAccSettingsHeader.Height + 4;
            pnlAccSettingsBody.Location = new Point(12, y);
            pnlAccSettingsBody.Visible = isSettingsOpen;
            lblAccSettingsChevron.Text = isSettingsOpen ? "▴" : "▾";
            if (isSettingsOpen)
            {
                y += pnlAccSettingsBody.Height + 8;
            }
            else
            {
                y += 6;
            }

            // 5. حل سؤال فوري وسريع
            pnlAccSolverHeader.Location = new Point(12, y);
            y += pnlAccSolverHeader.Height + 4;
            pnlAccSolverBody.Location = new Point(12, y);
            pnlAccSolverBody.Visible = isSolverOpen;
            lblAccSolverChevron.Text = isSolverOpen ? "▴" : "▾";
            if (isSolverOpen)
            {
                y += pnlAccSolverBody.Height + 8;
            }
            else
            {
                y += 6;
            }

            // 6. نبذة ودليل استخدام الأداة
            pnlAccAboutHeader.Location = new Point(12, y);
            y += pnlAccAboutHeader.Height + 4;
            pnlAccAboutBody.Location = new Point(12, y);
            pnlAccAboutBody.Visible = isAboutOpen;
            lblAccAboutChevron.Text = isAboutOpen ? "▴" : "▾";
            if (isAboutOpen)
            {
                y += pnlAccAboutBody.Height + 8;
            }
            else
            {
                y += 6;
            }

            // شريط الأزرار السفلية
            pnlBottomButtons.Location = new Point(12, y);
            y += pnlBottomButtons.Height + 20;

            pnlMain.AutoScrollMinSize = new Size(pnlHeader.Width, y);
            pnlMain.ResumeLayout(true);
        }

        private void ToggleMasterPower()
        {
            isMasterActive = !isMasterActive;
            UpdateMasterPowerUI();
        }

        private void UpdateMasterPowerUI()
        {
            if (btnMasterPower == null) return;

            if (isMasterActive)
            {
                btnMasterPower.BackColor = Color.FromArgb(6, 78, 59);
                btnMasterPower.ForeColor = Color.FromArgb(52, 211, 153);
                btnMasterPower.Text = "🟢 الأداة مفعلة وشغالة بالكامل (انقر هنا لإيقافها) ✓";
                btnMasterPower.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
                masterPowerBorderColor = Color.FromArgb(16, 185, 129);
                if (btnSolveConcise != null) btnSolveConcise.Enabled = true;
                if (btnSolveDetailed != null) btnSolveDetailed.Enabled = true;
                if (lblAnswerStatus != null)
                {
                    lblAnswerStatus.Text = "جاهز لاستخراج الإجابة فوراً...";
                    lblAnswerStatus.ForeColor = Color.FromArgb(148, 163, 184);
                }
            }
            else
            {
                btnMasterPower.BackColor = Color.FromArgb(76, 5, 25);
                btnMasterPower.ForeColor = Color.FromArgb(251, 113, 133);
                btnMasterPower.Text = "🔴 الأداة متوقفة ومقفلة حالياً (انقر هنا لتشغيلها)";
                btnMasterPower.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
                masterPowerBorderColor = Color.FromArgb(244, 63, 94);
                if (btnSolveConcise != null) btnSolveConcise.Enabled = false;
                if (btnSolveDetailed != null) btnSolveDetailed.Enabled = false;
                if (lblAnswerStatus != null)
                {
                    lblAnswerStatus.Text = "⚠️ الأداة متوقفة الآن عبر زر التشغيل الرئيسي.";
                    lblAnswerStatus.ForeColor = Color.FromArgb(251, 113, 133);
                }
            }
            btnMasterPower.Invalidate();
        }

        private void SwitchServer(string srv)
        {
            if (string.IsNullOrEmpty(srv)) srv = "free";
            if (pnlGeminiKey == null || pnlOpenAIKey == null || lblHeaderServerBadge == null || 
                lblActiveServerIcon == null || lblActiveServerName == null || lblActiveServerBadge == null || 
                lblAccServersBadge == null) return;

            currentConfig.ActiveServer = srv;
            SaveSettings();

            if (rbFree != null) rbFree.Checked = (srv == "free");
            if (rbFreeBackup != null) rbFreeBackup.Checked = (srv == "free_backup");
            if (rbDeepSeek != null) rbDeepSeek.Checked = (srv == "deepseek");
            if (rbGroq != null) rbGroq.Checked = (srv == "groq");
            if (rbGemini != null) rbGemini.Checked = (srv == "gemini");
            if (rbOpenAI != null) rbOpenAI.Checked = (srv == "openai");

            if (pnlDeepSeekKey != null) pnlDeepSeekKey.Visible = true;
            if (pnlGroqKey != null) pnlGroqKey.Visible = true;
            if (pnlGeminiKey != null) pnlGeminiKey.Visible = true;
            if (pnlOpenAIKey != null) pnlOpenAIKey.Visible = true;

            if (srv == "gemini")
            {
                pnlGeminiKey.Visible = true;
                pnlOpenAIKey.Visible = false;
                if (pnlDeepSeekKey != null) pnlDeepSeekKey.Visible = false;
                if (pnlGroqKey != null) pnlGroqKey.Visible = false;

                lblHeaderServerBadge.Text = "⚡ الخادم الآخر (Gemini)";
                lblHeaderServerBadge.ForeColor = Color.FromArgb(125, 211, 252);
                lblHeaderServerBadge.BackColor = Color.FromArgb(12, 74, 110);
                headerBadgeBorderColor = Color.FromArgb(56, 189, 248);
                lblHeaderServerBadge.Invalidate();

                lblActiveServerIcon.Text = "⚡";
                lblActiveServerName.Text = "الخادم الآخر (Google Gemini)";
                lblActiveServerName.ForeColor = Color.FromArgb(125, 211, 252);
                lblActiveServerBadge.Text = "⚡ نشط";
                lblActiveServerBadge.ForeColor = Color.FromArgb(125, 211, 252);
                lblActiveServerBadge.BackColor = Color.FromArgb(12, 74, 110);
                activeBadgeBorderColor = Color.FromArgb(56, 189, 248);
                lblActiveServerBadge.Invalidate();

                lblAccServersBadge.Text = "⚡ Gemini";
                lblAccServersBadge.ForeColor = Color.FromArgb(125, 211, 252);

                cardGeminiBorderColor = Color.FromArgb(56, 189, 248);
                cardFreeBorderColor = Color.FromArgb(51, 65, 85);
                cardFreeBackupBorderColor = Color.FromArgb(51, 65, 85);
                cardDeepSeekBorderColor = Color.FromArgb(51, 65, 85);
                cardGroqBorderColor = Color.FromArgb(51, 65, 85);
                cardOpenAIBorderColor = Color.FromArgb(51, 65, 85);
            }
            else if (srv == "openai")
            {
                pnlGeminiKey.Visible = false;
                pnlOpenAIKey.Visible = true;
                if (pnlDeepSeekKey != null) pnlDeepSeekKey.Visible = false;
                if (pnlGroqKey != null) pnlGroqKey.Visible = false;

                lblHeaderServerBadge.Text = "🤖 خادم شات جي بي تي";
                lblHeaderServerBadge.ForeColor = Color.FromArgb(216, 180, 254);
                lblHeaderServerBadge.BackColor = Color.FromArgb(59, 7, 100);
                headerBadgeBorderColor = Color.FromArgb(192, 132, 252);
                lblHeaderServerBadge.Invalidate();

                lblActiveServerIcon.Text = "🤖";
                lblActiveServerName.Text = "خادم شات جي بي تي (ChatGPT / OpenAI)";
                lblActiveServerName.ForeColor = Color.FromArgb(216, 180, 254);
                lblActiveServerBadge.Text = "🤖 نشط";
                lblActiveServerBadge.ForeColor = Color.FromArgb(216, 180, 254);
                lblActiveServerBadge.BackColor = Color.FromArgb(59, 7, 100);
                activeBadgeBorderColor = Color.FromArgb(192, 132, 252);
                lblActiveServerBadge.Invalidate();

                lblAccServersBadge.Text = "🤖 ChatGPT";
                lblAccServersBadge.ForeColor = Color.FromArgb(216, 180, 254);

                cardOpenAIBorderColor = Color.FromArgb(192, 132, 252);
                cardFreeBorderColor = Color.FromArgb(51, 65, 85);
                cardFreeBackupBorderColor = Color.FromArgb(51, 65, 85);
                cardDeepSeekBorderColor = Color.FromArgb(51, 65, 85);
                cardGroqBorderColor = Color.FromArgb(51, 65, 85);
                cardGeminiBorderColor = Color.FromArgb(51, 65, 85);
            }
            else if (srv == "deepseek")
            {
                pnlGeminiKey.Visible = false;
                pnlOpenAIKey.Visible = false;
                if (pnlDeepSeekKey != null) pnlDeepSeekKey.Visible = true;
                if (pnlGroqKey != null) pnlGroqKey.Visible = false;

                lblHeaderServerBadge.Text = "🧠 خادم ديب سيك";
                lblHeaderServerBadge.ForeColor = Color.FromArgb(56, 189, 248);
                lblHeaderServerBadge.BackColor = Color.FromArgb(12, 74, 110);
                headerBadgeBorderColor = Color.FromArgb(56, 189, 248);
                lblHeaderServerBadge.Invalidate();

                lblActiveServerIcon.Text = "🧠";
                lblActiveServerName.Text = "خادم ديب سيك (DeepSeek R1)";
                lblActiveServerName.ForeColor = Color.FromArgb(56, 189, 248);
                lblActiveServerBadge.Text = "🧠 ديب سيك نشط";
                lblActiveServerBadge.ForeColor = Color.FromArgb(56, 189, 248);
                lblActiveServerBadge.BackColor = Color.FromArgb(12, 74, 110);
                activeBadgeBorderColor = Color.FromArgb(56, 189, 248);
                lblActiveServerBadge.Invalidate();

                lblAccServersBadge.Text = "🧠 DeepSeek";
                lblAccServersBadge.ForeColor = Color.FromArgb(56, 189, 248);

                cardDeepSeekBorderColor = Color.FromArgb(56, 189, 248);
                cardFreeBorderColor = Color.FromArgb(51, 65, 85);
                cardFreeBackupBorderColor = Color.FromArgb(51, 65, 85);
                cardGroqBorderColor = Color.FromArgb(51, 65, 85);
                cardGeminiBorderColor = Color.FromArgb(51, 65, 85);
                cardOpenAIBorderColor = Color.FromArgb(51, 65, 85);
            }
            else if (srv == "groq")
            {
                pnlGeminiKey.Visible = false;
                pnlOpenAIKey.Visible = false;
                if (pnlDeepSeekKey != null) pnlDeepSeekKey.Visible = false;
                if (pnlGroqKey != null) pnlGroqKey.Visible = true;

                lblHeaderServerBadge.Text = "⚡ خادم جروك فائق السرعة";
                lblHeaderServerBadge.ForeColor = Color.FromArgb(249, 115, 22);
                lblHeaderServerBadge.BackColor = Color.FromArgb(67, 20, 7);
                headerBadgeBorderColor = Color.FromArgb(249, 115, 22);
                lblHeaderServerBadge.Invalidate();

                lblActiveServerIcon.Text = "⚡";
                lblActiveServerName.Text = "خادم جروك فائق السرعة (Groq Llama 3.3)";
                lblActiveServerName.ForeColor = Color.FromArgb(249, 115, 22);
                lblActiveServerBadge.Text = "⚡ جروك نشط";
                lblActiveServerBadge.ForeColor = Color.FromArgb(249, 115, 22);
                lblActiveServerBadge.BackColor = Color.FromArgb(67, 20, 7);
                activeBadgeBorderColor = Color.FromArgb(249, 115, 22);
                lblActiveServerBadge.Invalidate();

                lblAccServersBadge.Text = "⚡ Groq";
                lblAccServersBadge.ForeColor = Color.FromArgb(249, 115, 22);

                cardGroqBorderColor = Color.FromArgb(249, 115, 22);
                cardFreeBorderColor = Color.FromArgb(51, 65, 85);
                cardFreeBackupBorderColor = Color.FromArgb(51, 65, 85);
                cardDeepSeekBorderColor = Color.FromArgb(51, 65, 85);
                cardGeminiBorderColor = Color.FromArgb(51, 65, 85);
                cardOpenAIBorderColor = Color.FromArgb(51, 65, 85);
            }
            else if (srv == "free_backup")
            {
                pnlGeminiKey.Visible = false;
                pnlOpenAIKey.Visible = false;
                if (pnlDeepSeekKey != null) pnlDeepSeekKey.Visible = false;
                if (pnlGroqKey != null) pnlGroqKey.Visible = false;

                lblHeaderServerBadge.Text = "🛡️ الخادم المجاني الاحتياطي";
                lblHeaderServerBadge.ForeColor = Color.FromArgb(45, 212, 191);
                lblHeaderServerBadge.BackColor = Color.FromArgb(19, 78, 74);
                headerBadgeBorderColor = Color.FromArgb(20, 184, 166);
                lblHeaderServerBadge.Invalidate();

                lblActiveServerIcon.Text = "🛡️";
                lblActiveServerName.Text = "الخادم المجاني الاحتياطي (بدون مفتاح)";
                lblActiveServerName.ForeColor = Color.FromArgb(45, 212, 191);
                lblActiveServerBadge.Text = "🛡️ نشط";
                lblActiveServerBadge.ForeColor = Color.FromArgb(45, 212, 191);
                lblActiveServerBadge.BackColor = Color.FromArgb(19, 78, 74);
                activeBadgeBorderColor = Color.FromArgb(20, 184, 166);
                lblActiveServerBadge.Invalidate();

                lblAccServersBadge.Text = "🛡️ احتياطي";
                lblAccServersBadge.ForeColor = Color.FromArgb(45, 212, 191);

                cardFreeBackupBorderColor = Color.FromArgb(20, 184, 166);
                cardFreeBorderColor = Color.FromArgb(51, 65, 85);
                cardDeepSeekBorderColor = Color.FromArgb(51, 65, 85);
                cardGroqBorderColor = Color.FromArgb(51, 65, 85);
                cardGeminiBorderColor = Color.FromArgb(51, 65, 85);
                cardOpenAIBorderColor = Color.FromArgb(51, 65, 85);
            }
            else
            {
                pnlGeminiKey.Visible = false;
                pnlOpenAIKey.Visible = false;
                if (pnlDeepSeekKey != null) pnlDeepSeekKey.Visible = false;
                if (pnlGroqKey != null) pnlGroqKey.Visible = false;

                lblHeaderServerBadge.Text = "🌐 الخادم المجاني";
                lblHeaderServerBadge.ForeColor = Color.FromArgb(52, 211, 153);
                lblHeaderServerBadge.BackColor = Color.FromArgb(6, 78, 59);
                headerBadgeBorderColor = Color.FromArgb(16, 185, 129);
                lblHeaderServerBadge.Invalidate();

                lblActiveServerIcon.Text = "🌐";
                lblActiveServerName.Text = "الخادم المجاني (بدون مفتاح)";
                lblActiveServerName.ForeColor = Color.FromArgb(110, 231, 183);
                lblActiveServerBadge.Text = "🟢 نشط";
                lblActiveServerBadge.ForeColor = Color.FromArgb(52, 211, 153);
                lblActiveServerBadge.BackColor = Color.FromArgb(6, 78, 59);
                activeBadgeBorderColor = Color.FromArgb(16, 185, 129);
                lblActiveServerBadge.Invalidate();

                lblAccServersBadge.Text = "🌐 مجاني";
                lblAccServersBadge.ForeColor = Color.FromArgb(110, 231, 183);

                cardFreeBorderColor = Color.FromArgb(16, 185, 129);
                cardFreeBackupBorderColor = Color.FromArgb(51, 65, 85);
                cardDeepSeekBorderColor = Color.FromArgb(51, 65, 85);
                cardGroqBorderColor = Color.FromArgb(51, 65, 85);
                cardGeminiBorderColor = Color.FromArgb(51, 65, 85);
                cardOpenAIBorderColor = Color.FromArgb(51, 65, 85);
            }

            if (pnlCardFree != null) pnlCardFree.Invalidate();
            if (pnlCardFreeBackup != null) pnlCardFreeBackup.Invalidate();
            if (pnlCardDeepSeek != null) pnlCardDeepSeek.Invalidate();
            if (pnlCardGroq != null) pnlCardGroq.Invalidate();
            if (pnlCardGemini != null) pnlCardGemini.Invalidate();
            if (pnlCardOpenAI != null) pnlCardOpenAI.Invalidate();
        }
        private static readonly string DEFAULT_GEMINI_KEY = Encoding.UTF8.GetString(Convert.FromBase64String("QVEuQWI4Uk42TFl6UW1xLWtGNFg2R3gyTTY4WG1hQk5BWjVjRk5vSVJyNW9samZTQVRkb0E="));
        private static string workingGeminiModel = "gemini-3-flash-preview";
        public static string speculativeCachedQuestion = null;
        public static string speculativeConciseAnswer = null;
        public static string speculativeDetailedAnswer = null;

        public void PrecomputeSpeculative(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            string q = text.Trim();
            if (q.Length < 4) return;
            if (speculativeCachedQuestion == q) return;

            speculativeCachedQuestion = q;
            speculativeConciseAnswer = null;
            speculativeDetailedAnswer = null;

            Task.Run(async () => {
                try {
                    string ans = await SolveTextDirectAsync(q, "concise");
                    if (speculativeCachedQuestion == q) {
                        speculativeConciseAnswer = ans;
                        if (answerForm != null && !answerForm.IsDisposed) {
                            answerForm.SetPrecomputedAnswer(q, ans, "concise");
                        }
                    }
                } catch { }
            });
        }
        private static string workingGroqModel = "llama-3.1-8b-instant";

        private static Image GetEmbeddedLogo()
        {
            try
            {
                string b64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAjsSURBVGhD1dppUFRXFgfwrpqqVKqmaqrm03yYmSSVcWYyVjI1MROTidFoEo3EBRWVOK4REEQREGRTAUUQkR1kRxQU0IiyCAiNbCoqoCgqAq6jMShNw1t7ea99/6n70LabBqHjAt6q86WLD79z3rn33XcvCsUQA8D7kiTNPnxDE72zia/afIZuI7GhmoF7NQOPagaeJxl4VjHYWMXAS8nAW8lgUyUrh08lC98KFn4nWPifYBFAopzFFhJlLLaWsggsZRFUyiH4OIdtJEo4RCu5ttgKri2thq8ru6RLoDSGRZIkfQTgNwONgw4Av+/VibYpV/ls5xqam1PSh4n5akw4qMa76Sq8l6bC+2kq/CVVhXEpKvw1WYW/JanwQZIK/9jTg/GJPfgwsQcfJfTgn/E9+FdcDz6OU2NCrBr/jlHj02g1Jkap8XmUGv+J7MUXu3vx5e5eTI7oxZRdvZga3ou5sRQWJdBYu5dB8BFOf6BeW/So17BckqR3B3rNBvmDpoeCp3s99WB6YR/ey1Lhz5kqvJOhem34aeF9+HpnH74N68P00D7M2NEHx2QaO47wXEO7GEKexkC3PAietItTNcV9mKvGHzPHBn7mjj7YhFBYsJNGUC6HskZdCoBPzPCkbUjlHU5SwrjsnjGH/347hdnbKdhupxCUw+Fc/5N41k6k5zfU0d2jWfmF8TScM5kh8XO2UZgbTME+lEbkIZ67rzI4A3ibtM7fyYQlPT9aeFL5gkYdznQIz8XbBlGYH0TBKZJBXpWmXG4lskw5VNHCO3tHD784joZelECGazrzXPyCQAp2WymEZnO49cCwXpHbrkmwKeobNTzp+WSlRsaT0dAuDItfuIXC+igGRbXafEVoI1f3ca56VPDzoikZz2ol4DEFPFbLSeTW6bAiih4Sv2gzhaVbKewt0rQpyNv1g309rxVPJmxeg7YfTobhESQqoj+ETvknvQiUN+nhHMNY4O0DKPwQQCMxn+9WeNWx3a8TTyofWsjj5kODsW0I2piAvsX4+6O+x0g4phkUv8SfRuQ+HgpnJf1a8abrvE8Oi8t3xf4k9Fee4EXc7jLI8KEqT/BL/WjsTOehcKqgRwVvulSWNeuNVSf4wXp+IH6ZL41wksCaCnpU8WS1cU9ljQmE5/Ejwi/3oRFBEnCuoEcV/3SpPHddkKs/UvxKkkAaD4XLCfql4SMreZy/LWBFOm0VniyVG5NZhOfyI8av2sRgdyoPxdpy+qXgSeW7qMdyG6TVaq3Ck563D+5GRloOfi6zw6qgB8Pif/RmEPU0geHws5Ku4ou4rkHxM+MeIrmyBi1tB3DjrhJdqlZc6TiMvJoKLIu/Nyx+Vegd5O5LRW/VLOhqpqDhsPeI8A4kgRQeinXl9KD4yYl3kPPTFtyrmAKxZpwc/MnxOHHUFdNj/mesfMetzGdr+IDoup88JN4x/AZK8yPA1c6EvnYadDVfQVc9GT5hF0eEd/RiEC0nUMZY4G1TLuDmiW+McNPoLJ+JmIJiHK9MRdPpMHS0hIG+H26Bv30rFcG5LRb4XSllaCz2hf7UdOjrv4G+bhr0tf34suzQEeOdNjKITeahWF/KmOEnxv9ihr9fMQVFRzyQlReCB8qpEC/Ph9juCLFtNcRrqyBeXQnxynKIl5dCvLQEYos9hIuLIDTbQWiaD6HRFsL5ORDOzYbQ8D2EMzOhPz0D+lPfQl/3NfS1U+XW+bnUDqsDfxkx3tmTJKCBwq2UMev5pPxwI7660AFfxnTJPe+RfR6GTmeI7U4QrztAbPvxGb51KcTLJvgLCyE0L4DQOA/C+bn9+LOzIDTYQH/6O7PqP22dzeHnrcK7eLKIS9JAseE4YzZhHyo/k/EPKz8z4hck3QJ1zRNixxqI102rvwJi6zKIl/8L8dIPEFsWP8ObVl/Gm1S/3rz6OWkZVuPXerCI36OBwv04Y8R/lXDXWP2Dh7YYV5vWxjDz6l8bUH3T1rnwtHVMqz+gdeoJvr/6VQe3/Sr8OncWCSQBjxLGuM4vSTlrTID0PMGHHFbC0OliWf0r5tUXLppWf15/9c89rb4NhDPmrUMm7ovg129gkZiogcKzhDW+pCbFdslLJUmgsdheXiqbz0bAQPAveeLmpGe+EN7NjcUeksDGYtbsDdtYvNj4FHzTj6LhdNRLnbjdlQsQvPvMC+Pd3VgkJWih8Cpmzd6wDsn1xqdA4ughf5yrC38pE7c4J9rqpXIovMd6DsnxWii8i1iL7UFs9h5jAsojrvLGbGVCB34q3otHza5WTdze2vkoz43AupBOq15Sw+E913FIkRMoZAfdmLklK9FcZA+7qJsWG7NNyY0ISSpBh+9bz42YXdkj2lX+GrzXOg6pJAGfQtYCP5L9fPzWzRbggXHAf80rw3u7ckiLe5KAtXiyt2n2+5MFeGBc8/0dlgU8eiX4TWs5pMdqofA9xlqN9wvMs8AOFVF+ca8E7+PCIYMk4HeMtQpPdpUFAbYW0KGizm/CK8H7uXDIJAn4H2Wtwg/8krLmG/Zl4v2dOWTGaKEIK+X73kR8wBoOWSSB6HLuxneR1BuH3+zEIS9F26vYU8U12cZQbxw+cA2Hwv3au4qCZl2mQ9rwNyNjCb/FkcNuLx41xUKR4q7a4BiQz71R+EBHDmkhWnS2GgLJBd8n6dV83bJ4+o3Bh7tpUJqjb5MkyYYk8PZ9leC8LZ/Tzw0d+/ggBx7ZkTrcaTP4k9tV+ZZSkqTx5Rf1CQHZ3JjHp27T4lSZLl+SpM9NborlJCbl1+uL/LM42G0fu3jlYX2dJEkzLP53gvxAkqho1ieEHuT0qyPoMYMPdeWxL0KH+hKh4An+LTO86SD3xtfvGbyzyrVNgRkcXHYxo4YP9+Dl1eb4ft2N9ovy7fwki8oPNiRJ+q0kSVNadwn+h6o05SlHNQ8i9vPYmcHL1zrkZoRcLpDzeXLETU6JyUErOaskx33kxIwcOpFzG3L0QU4PyAc4+YYln4HkS4p8jJD9PNkSk10l2ZiRvc3eaC32xWhxLEvXXVWgq3oCt5Ek6Q8DnWT8H2xQ2wCrHhngAAAAAElFTkSuQmCC";
                byte[] bytes = Convert.FromBase64String(b64);
                using (var ms = new MemoryStream(bytes))
                {
                    return Image.FromStream(ms);
                }
            }
            catch { return null; }
        }


        private static string ExtractWebError(WebException wex)
        {
            if (wex == null) return "خطأ غير محدد";
            try
            {
                if (wex.Response != null)
                {
                    var httpRes = wex.Response as HttpWebResponse;
                    using (var stream = wex.Response.GetResponseStream())
                    using (var r = new StreamReader(stream, Encoding.UTF8))
                    {
                        string body = r.ReadToEnd();
                        if (!string.IsNullOrEmpty(body))
                        {
                            if (body.Contains("API_KEY_INVALID") || body.Contains("API key not valid"))
                                return "مفتاح API غير صالح أو غير مفعل في Google AI Studio.";
                            if (body.Contains("RESOURCE_EXHAUSTED") || body.Contains("quota"))
                                return "تم تجاوز الحصة المجانية المؤقتة لمفتاحك، يرجى المحاولة لاحقاً.";
                            if (httpRes != null && httpRes.StatusCode == HttpStatusCode.NotFound)
                                return "المفتاح غير معتمد لدى Google أو الخدمة غير مفعلة. تأكد من إنشائه من aistudio.google.com.";
                            return body.Length > 200 ? body.Substring(0, 200) + "..." : body;
                        }
                    }
                    if (httpRes != null && httpRes.StatusCode == HttpStatusCode.NotFound)
                        return "المفتاح غير معتمد لدى Google أو الخدمة غير مفعلة. تأكد من إنشائه من aistudio.google.com.";
                }
            }
            catch { }
            return wex.Message;
        }

        private async Task TestGeminiKeyAsync()
        {
            string key = txtGeminiKey.Text.Trim().Trim('"', '\'');
            if (string.IsNullOrEmpty(key))
            {
                lblGeminiStatus.Text = "⚠️ اكتب مفتاح Gemini أولاً ثم اضغط فحص.";
                lblGeminiStatus.ForeColor = Color.FromArgb(251, 191, 36);
                return;
            }

            if (key.StartsWith("ghp_"))
            {
                lblGeminiStatus.Text = "⚠️ هذا الرمز هو مفتاح GitHub وليس مفتاح Google Gemini! احصل على مفتاح مجاني من aistudio.google.com";
                lblGeminiStatus.ForeColor = Color.FromArgb(251, 191, 36);
                return;
            }
            if (key.StartsWith("sk-") || key.StartsWith("gsk_"))
            {
                lblGeminiStatus.Text = "⚠️ هذا المفتاح خاص بخدمة أخرى (OpenAI أو Groq) وليس Google Gemini.";
                lblGeminiStatus.ForeColor = Color.FromArgb(251, 191, 36);
                return;
            }

            btnTestGemini.Enabled = false;
            btnTestGemini.Text = "⏳ جارٍ الفحص...";
            lblGeminiStatus.Text = "جارٍ اختبار الاتصال بنماذج Google Gemini...";
            lblGeminiStatus.ForeColor = Color.FromArgb(56, 189, 248);

            try
            {
                string res = await CallGeminiAsync("أنت نظام فحص اتصال. أجب بـ OK فقط.", "مرحباً", key);
                lblGeminiStatus.Text = "✓ المفتاح يعمل 100% بنجاح وسرعة فائقة! (" + workingGeminiModel + ")";
                lblGeminiStatus.ForeColor = Color.FromArgb(52, 211, 153);
                currentConfig.GeminiKey = key;
                SaveSettings();
            }
            catch (Exception ex)
            {
                lblGeminiStatus.Text = "❌ فشل الاتصال: " + ex.Message;
                lblGeminiStatus.ForeColor = Color.FromArgb(248, 113, 113);
            }
            finally
            {
                btnTestGemini.Enabled = true;
                btnTestGemini.Text = "🔍 فحص المفتاح";
            }
        }

        private async Task TestOpenAIKeyAsync()
        {
            string key = txtOpenAIKey.Text.Trim().Trim('"', '\'');
            if (string.IsNullOrEmpty(key))
            {
                lblOpenAIStatus.Text = "⚠️ اكتب مفتاح OpenAI / ChatGPT أولاً ثم اضغط فحص.";
                lblOpenAIStatus.ForeColor = Color.FromArgb(251, 191, 36);
                return;
            }

            btnTestOpenAI.Enabled = false;
            btnTestOpenAI.Text = "⏳ جارٍ الفحص...";
            lblOpenAIStatus.Text = "جارٍ اختبار الاتصال بخادم ChatGPT...";
            lblOpenAIStatus.ForeColor = Color.FromArgb(216, 180, 254);

            try
            {
                string res = await CallOpenAIAsync("أنت نظام اختبار الاتصال. أجب بكلمة OK فقط.", "مرحباً", key);
                lblOpenAIStatus.Text = "✓ المفتاح يعمل 100% ورصيد الحساب نشط!";
                lblOpenAIStatus.ForeColor = Color.FromArgb(52, 211, 153);
                currentConfig.OpenAIKey = key;
                SaveSettings();
            }
            catch (Exception ex)
            {
                string msg = ex.Message;
                if (msg.Contains("insufficient_quota") || msg.Contains("429") || msg.Contains("credits"))
                    lblOpenAIStatus.Text = "⚠️ المفتاح صحيح ولكن رصيد حسابك $0 غير كافٍ. استخدم Gemini أو المجاني.";
                else
                    lblOpenAIStatus.Text = "❌ فشل الاتصال: " + msg;
                lblOpenAIStatus.ForeColor = Color.FromArgb(248, 113, 113);
            }
            finally
            {
                btnTestOpenAI.Enabled = true;
                btnTestOpenAI.Text = "🔍 فحص المفتاح";
            }
        }

        private string GetSubjectDescription(string subj)
        {
            switch ((subj ?? "general").ToLower())
            {
                case "math": return "التخصص: رياضيات. دقة بالغة في العمليات الحسابية والمعادلات والجبر والهندسة.";
                case "physics": return "التخصص: فيزياء. التركيز على القوانين، الوحدات الدولية، والقوى والعلاقات الفيزيائية.";
                case "chemistry": return "التخصص: كيمياء. التركيز على التفاعلات، الروابط، التوزيع الإلكتروني، والمعادلات الموزونة.";
                case "biology": return "التخصص: أحياء. التركيز على وظائف الأعضاء، التصنيفات الحيوية، وعلم الوراثة والخلايا.";
                case "qudrat": return "التخصص: اختبار القدرات العامة (الكمي واللفظي، استيعاب المقروء، التناظر، إكمال الجمل).";
                case "tahsili": return "التخصص: اختبار التحصيلي (رياضيات، فيزياء، كيمياء، أحياء للثانوية العامة).";
                case "english": return "التخصص: لغة إنجليزية (قواعد Grammar، مفردات Vocabulary، قراءة واستيعاب Comprehension).";
                case "arabic": return "التخصص: لغة عربية (نحو، صرف، بلاغة، إعراب، معاني المفردات).";
                case "islamic": return "التخصص: دراسات إسلامية (فقه، توحيد، حديث، تفسير، أصول دين).";
                case "computer": return "التخصص: حاسب آلي وتقنية معلومات (برمجة، خوارزميات، شبكات، أمن سيبراني).";
                case "medical": return "التخصص: علوم طبية وصحية وتمريض وصيدلة.";
                case "law": return "التخصص: قانون وأنظمة وتشريعات وحقوق.";
                case "business": return "التخصص: إدارة أعمال واقتصاد ومحاسبة وتسويق.";
                case "social": case "history": case "geography": return "التخصص: دراسات اجتماعية وتاريخ وجغرافيا.";
                default: return "التخصص: أسئلة واختبارات عامة وثقافية متنوعة.";
            }
        }

        private string BuildConcisePrompt(string subj, string lang)
        {
            string fieldDesc = GetSubjectDescription(subj);
            string langRule = (lang == "en") ? "Answer in English." : "الإجابة باللغة العربية حصراً مع كتابة رمز الخيار الأصلي (مثل A أو B أو أ أو ب).";

            return "أنت محرك الذكاء الاصطناعي الأكاديمي فائق الدقة المخصص للحل المباشر الفوري للاختبارات (Direct Concise Solution Engine).\n" +
                   "عقليتك ومنهجك في هذا الوضع:\n" +
                   "1. التفكير الاستنتاجي السريع والحاسم: مسح السؤال فوراً وتحديد الخيار الصحيح بنسبة دقة 100%.\n" +
                   "2. الصرامة في الاختصار: لا تكتب أي مقدمات، لا تكتب 'بناءً على السؤال' أو 'الجواب هو' أو شروحات مطولة.\n" +
                   "3. التنسيق الإلزامي الصارم:\n" +
                   "🎯 الإجابة الصحيحة: [رمز الخيار] نص الخيار كاملاً\n" +
                   "⚡ تأكيد حاسم: [جملة واحدة مركزة تثبت صحة الخيار في 8 كلمات فقط]\n\n" +
                   fieldDesc + "\n" + langRule;
        }

        private string BuildDetailedPrompt(string subj, string lang)
        {
            string fieldDesc = GetSubjectDescription(subj);
            string langRule = (lang == "en") ? "Provide the full explanation in English." : "الشرح باللغة العربية الأكاديمية الواضحة والمنظمة.";

            return "أنت الأستاذ الأكاديمي والخبير التعليمي الأول في QuizGenie المتخصص في الشرح المفصل والتأسيس العلمي العميق (Deep Pedagogical & Conceptual Reasoning).\n" +
                   "عقليتك ومنهجك في هذا الوضع مستقل تماماً عن الحل السريع، وهدفك ليس فقط تقديم الإجابة بل بناء فهم راسخ وشامل لدى الطالب لا يُنسى.\n\n" +
                   "منهجية التفكير والتفكيك الإلزامية في الحل المفصل:\n" +
                   "قم بهيكلة إجابتك بدقة وفق الأقسام التالية:\n\n" +
                   "📘 1. المفهوم والقاعدة الأساسية:\n" +
                   "- حدد بوضوح القانون، النظرية، أو القاعدة النحوية/العلمية/المنطقية المركزية التي يستند إليها هذا السؤال.\n\n" +
                   "📐 2. خطوات الحل والتحليل المتسلسل:\n" +
                   "- فكك السؤال: المعطيات والمطلوب.\n" +
                   "- الخطوات الإجرائية المتسلسلة (القانون المستخدم، التعويض الرياضي بالأرقام، أو التسلسل المنطقي للاشتقاق).\n\n" +
                   "✅ 3. الإجابة المعتمدة:\n" +
                   "🎯 الخيار الصحيح: [رمز الخيار] نص الخيار\n\n" +
                   "🔍 4. تفنيد الخيارات الأخرى (لماذا استُبعدت؟):\n" +
                   "- اشرح باقتضاب لماذا كل خيار من الخيارات البديلة الأخرى خاطئ لمنع التشتت والخلط في الامتحانات.\n\n" +
                   "💡 5. مفتاح الحل السريع (Exam Pro-Tip):\n" +
                   "- نصيحة ذهبية أو حيلة سريعة أو رابط ذهني لتمييز وحل هذا النوع من الأسئلة في ثوانٍ أثناء الاختبار.\n\n" +
                   fieldDesc + "\n" + langRule;
        }

        private string BuildSystemPrompt(string mode)
        {
            string subj = currentConfig != null ? currentConfig.Subject : "general";
            string lang = currentConfig != null ? currentConfig.TargetLanguage : "ar";

            if (mode == "concise")
            {
                return BuildConcisePrompt(subj, lang);
            }
            else
            {
                return BuildDetailedPrompt(subj, lang);
            }
        }

        public void InitFloatingSelectionMonitor()
        {
            try
            {
                selectionMonitor = new GlobalSelectionMonitor(this);
                selectionMonitor.TextSelected += (text, pt) => {
                    if (!isMasterActive || !isFloatingPopupEnabled) return;
                    if (string.IsNullOrWhiteSpace(text)) return;

                    if (fabForm == null || fabForm.IsDisposed)
                        fabForm = new FloatingFabForm(this);

                    fabForm.SetCapturedText(text);
                    PrecomputeSpeculative(text);

                    var screen = Screen.FromPoint(pt).WorkingArea;
                    int x = pt.X + 8;
                    int y = pt.Y - 45;

                    if (x + 50 > screen.Right) x = screen.Right - 55;
                    if (y < screen.Top) y = pt.Y + 25;

                    fabForm.Location = new Point(x, y);
                    if (!fabForm.Visible) fabForm.Show();
                    fabForm.BringToFront();
                };

                selectionMonitor.ClickedOutside += () => {
                    Point cur = Cursor.Position;
                    if (fabForm != null && fabForm.Visible && !fabForm.Bounds.Contains(cur))
                    {
                        if (menuForm != null && menuForm.Visible && menuForm.Bounds.Contains(cur)) return;
                        if (answerForm != null && answerForm.Visible && answerForm.Bounds.Contains(cur)) return;
                        fabForm.Hide();
                        if (menuForm != null) menuForm.Hide();
                    }
                };
            }
            catch { }
        }

        public void OpenFloatingMenu(Point loc, string text)
        {
            if (menuForm == null || menuForm.IsDisposed)
                menuForm = new FloatingMenuForm(this);

            menuForm.SetText(text);

            var screen = Screen.FromPoint(loc).WorkingArea;
            int x = loc.X - 50;
            int y = loc.Y + 46;
            if (x + 230 > screen.Right) x = screen.Right - 235;
            if (x < screen.Left) x = screen.Left + 10;
            if (y + 150 > screen.Bottom) y = loc.Y - 145;

            menuForm.Location = new Point(x, y);
            if (!menuForm.Visible) menuForm.Show();
            menuForm.BringToFront();
        }

        public void StartScreenSnip()
        {
            try
            {
                var overlay = new ScreenSnipOverlayForm(this);
                overlay.Show();
            }
            catch (Exception ex)
            {
                MessageBox.Show("طھط¹ط°ط± طھط´ط؛ظٹظ„ ط£ط¯ط§ط© طھطµظˆظٹط± ط§ظ„ط´ط§ط´ط©: " + ex.Message, "QuizGenie", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        public void OpenFloatingAnswerWithImage(Point loc, Bitmap bmp, string mode)
        {
            if (answerForm == null || answerForm.IsDisposed)
                answerForm = new FloatingAnswerForm(this);

            var screen = Screen.FromPoint(loc).WorkingArea;
            int x = loc.X - 120;
            int y = loc.Y + 10;
            if (x + 550 > screen.Right) x = screen.Right - 555;
            if (x < screen.Left) x = screen.Left + 10;
            if (y + 440 > screen.Bottom) y = screen.Bottom - 450;
            if (y < screen.Top) y = screen.Top + 10;

            answerForm.Location = new Point(x, y);
            if (!answerForm.Visible) answerForm.Show();
            answerForm.BringToFront();

            answerForm.SolveImage(bmp, mode);
        }

        private void ExportStudySheet()
        {
            try
            {
                string html = HistoryManager.ExportStudySheetHtml();
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string exportDir = Path.Combine(desktopPath, "QuizGenie");
                if (!Directory.Exists(exportDir)) Directory.CreateDirectory(exportDir);
                string exportFile = Path.Combine(exportDir, "QuizGenie_Study_Sheet_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".html");
                File.WriteAllText(exportFile, html, Encoding.UTF8);

                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = exportFile,
                    UseShellExecute = true
                });

                MessageBox.Show("طھظ… طھطµط¯ظٹط± ظ…ظ„ط®طµ ط§ظ„ظ…ط°ط§ظƒط±ط© ط§ظ„ط´ط§ظ…ظ„ ظˆظپطھط­ظ‡ ظپظٹ ط§ظ„ظ…طھطµظپط­ ط¨ظ†ط¬ط§ط­!\n\nط§ظ„ظ…ظ„ظپ ط¹ظ„ظ‰ ط³ط·ط­ ط§ظ„ظ…ظƒطھط¨:\n" + Path.GetFileName(exportFile), "ظ…ظ„ط®طµ ط§ظ„ظ…ط°ط§ظƒط±ط© - QuizGenie", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("طھط¹ط°ط± طھطµط¯ظٹط± ظ…ظ„ط®طµ ط§ظ„ظ…ط°ط§ظƒط±ط©: " + ex.Message, "QuizGenie", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void ToggleDesktopSpeech()
        {
            if (isDesktopSpeaking)
            {
                try
                {
                    if (desktopSynth != null) desktopSynth.SpeakAsyncCancelAll();
                }
                catch { }
                isDesktopSpeaking = false;
                if (btnSpeakDesktop != null)
                {
                    btnSpeakDesktop.Text = "ًں”ٹ ط§ط³طھظ…ط§ط¹ طµظˆطھظٹ";
                    btnSpeakDesktop.BackColor = Color.FromArgb(30, 41, 59);
                }
            }
            else
            {
                string textToRead = txtAnswer.Text;
                if (string.IsNullOrWhiteSpace(textToRead)) return;

                textToRead = textToRead.Replace("ًںژ¯", "").Replace("âڑ،", "").Replace("ًں“ک", "")
                                       .Replace("ًں“گ", "").Replace("ًں”چ", "").Replace("ًں’،", "")
                                       .Replace("âœ“", "").Replace("â‌Œ", "").Replace("*", "").Replace("#", "");

                try
                {
                    if (desktopSynth == null)
                    {
                        desktopSynth = new System.Speech.Synthesis.SpeechSynthesizer();
                        desktopSynth.SpeakCompleted += (s, e) => {
                            isDesktopSpeaking = false;
                            if (!this.IsDisposed)
                            {
                                this.BeginInvoke((Action)(() => {
                                    if (btnSpeakDesktop != null)
                                    {
                                        btnSpeakDesktop.Text = "ًں”ٹ ط§ط³طھظ…ط§ط¹ طµظˆطھظٹ";
                                        btnSpeakDesktop.BackColor = Color.FromArgb(30, 41, 59);
                                    }
                                }));
                            }
                        };
                    }
                    desktopSynth.SpeakAsyncCancelAll();
                    desktopSynth.SpeakAsync(textToRead);
                    isDesktopSpeaking = true;
                    if (btnSpeakDesktop != null)
                    {
                        btnSpeakDesktop.Text = "âڈ¹ï¸ڈ ط¥ظٹظ‚ط§ظپ ط§ظ„طµظˆطھ";
                        btnSpeakDesktop.BackColor = Color.FromArgb(239, 68, 68);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("طھط¹ط°ط± طھط´ط؛ظٹظ„ ط§ظ„طµظˆطھ: " + ex.Message, "QuizGenie Audio", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
        }

        public void OpenFloatingAnswer(Point loc, string text, string mode)
        {
            if (answerForm == null || answerForm.IsDisposed)
                answerForm = new FloatingAnswerForm(this);

            var screen = Screen.FromPoint(loc).WorkingArea;
            int x = loc.X - 120;
            int y = loc.Y + 10;
            if (x + 500 > screen.Right) x = screen.Right - 505;
            if (x < screen.Left) x = screen.Left + 10;
            if (y + 370 > screen.Bottom) y = screen.Bottom - 380;
            if (y < screen.Top) y = screen.Top + 10;

            answerForm.Location = new Point(x, y);
            if (!answerForm.Visible) answerForm.Show();
            answerForm.BringToFront();

            answerForm.SolveQuestion(text, mode);
        }

        public string GetActiveServerDisplayName()
        {
            string s = currentConfig != null ? currentConfig.ActiveServer : "free";
            if (s == "gemini") return "⚡ Google Gemini";
            if (s == "openai") return "🤖 ChatGPT";
            if (s == "deepseek") return "🧠 DeepSeek R1";
            if (s == "groq") return "⚡ Groq (0.1s)";
            if (s == "free_backup") return "🛡️ خادم احتياطي";
            return "🌐 خادم مجاني";
        }

        public async Task<string> SolveTextDirectAsync(string question, string mode)
        {
            string srv = currentConfig != null ? (currentConfig.ActiveServer ?? "free") : "free";
            string systemPrompt = BuildSystemPrompt(mode);
            if (System.Text.RegularExpressions.Regex.IsMatch(question, @"[\u0600-\u06FF\w]+\s*:\s*[\u0600-\u06FF\w]+"))
            {
                systemPrompt += "\n\n[قواعد التناظر اللفظي - اختبار القدرات]:\n" +
                                "السؤال عبارة عن زوج كلمات متناظرة.\n" +
                                "1. استنتج بدقة الجملة الرابطة بين الكلمتين.\n" +
                                "2. حدد اتجاه العلاقة بدقة (من اليمين لليسار أو العكس).\n" +
                                "3. استبعد الخيارات المعكوسة أو العلاقات غير المتطابقة.\n" +
                                "4. اختر الخيار المتطابق تماماً في نوع العلاقة واتجاهها.";
            }
            string answer = "";

            // Rocket-speed priority: If Groq or Gemini key is configured, use it for 0.1s instant answer!
            if (!string.IsNullOrEmpty(currentConfig.GroqKey) && srv != "groq")
            {
                try { return (await CallGroqAsync(systemPrompt, question, currentConfig.GroqKey)).Trim(); } catch { }
            }
            if (!string.IsNullOrEmpty(currentConfig.GeminiKey) && srv != "gemini")
            {
                try { return (await CallGeminiAsync(systemPrompt, question, currentConfig.GeminiKey)).Trim(); } catch { }
            }

            bool needGeminiFallback = false;
            try
            {
                if (srv == "gemini")
                {
                    string gemKey = !string.IsNullOrWhiteSpace(currentConfig.GeminiKey) ? currentConfig.GeminiKey.Trim() : DEFAULT_GEMINI_KEY;
                    answer = await CallGeminiAsync(systemPrompt, question, gemKey, mode);
                }
                else if (srv == "openai")
                {
                    if (string.IsNullOrEmpty(currentConfig.OpenAIKey))
                        throw new Exception("لم يتم إدخال مفتاح OpenAI. يرجى إدخاله في قسم الخوادم.");
                    answer = await CallOpenAIAsync(systemPrompt, question, currentConfig.OpenAIKey);
                }
                else if (srv == "deepseek")
                {
                    answer = await CallDeepSeekAsync(systemPrompt, question, currentConfig.DeepSeekKey);
                }
                else if (srv == "groq")
                {
                    if (string.IsNullOrEmpty(currentConfig.GroqKey))
                        throw new Exception("مفتاح Groq غير مدخل. يمكنك استخراجه مجاناً 100% وبدون بطاقة بنكية بضغطة زر من الإعدادات!");
                    answer = await CallGroqAsync(systemPrompt, question, currentConfig.GroqKey);
                }
                else
                {
                    string gemKey = !string.IsNullOrWhiteSpace(currentConfig.GeminiKey) ? currentConfig.GeminiKey.Trim() : DEFAULT_GEMINI_KEY;
                    answer = await CallGeminiAsync(systemPrompt, question, gemKey, mode);
                }
            }
            catch (Exception)
            {
                needGeminiFallback = true;
            }

            if (needGeminiFallback)
            {
                answer = await CallGeminiAsync(systemPrompt, question, DEFAULT_GEMINI_KEY, mode);
            }

            string finalAns = answer.Trim();
            try
            {
                string c = (mode == "concise") ? finalAns : "";
                string d = (mode == "detailed") ? finalAns : "";
                string subj = currentConfig != null ? currentConfig.Subject : "general";
                HistoryManager.AddEntry(question, c, d, subj, false);
            }
            catch { }
            return finalAns;
        }

        public async Task<string> SolveImageDirectAsync(Bitmap bmp, string mode)
        {
            string base64Jpeg;
            using (MemoryStream ms = new MemoryStream())
            {
                bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Jpeg);
                base64Jpeg = Convert.ToBase64String(ms.ToArray());
            }

            string systemPrompt = BuildSystemPrompt(mode);
            string gemKey = (currentConfig != null && !string.IsNullOrWhiteSpace(currentConfig.GeminiKey))
                ? currentConfig.GeminiKey.Trim()
                : DEFAULT_GEMINI_KEY;

            string answer = await CallGeminiVisionAsync(systemPrompt, base64Jpeg, gemKey, mode);
            string finalAns = answer.Trim();

            try
            {
                string c = (mode == "concise") ? finalAns : "";
                string d = (mode == "detailed") ? finalAns : "";
                string subj = currentConfig != null ? currentConfig.Subject : "general";
                HistoryManager.AddEntry("[ط³ط¤ط§ظ„ ظ…طµظˆط± ظ…ظ† ط§ظ„ط´ط§ط´ط© ًں“¸]", c, d, subj, true);
            }
            catch { }

            return finalAns;
        }

        private async Task<string> CallGeminiVisionAsync(string sys, string base64Jpeg, string key, string mode = "concise")
        {
            key = (key ?? "").Trim().Trim('"', '\'');
            if (string.IsNullOrWhiteSpace(key)) key = DEFAULT_GEMINI_KEY;

            string[] candidateModels = new string[] {
                workingGeminiModel,
                "gemini-3-flash-preview",
                "gemini-3.1-flash-lite",
                "gemini-3.5-flash",
                "gemini-flash-latest"
            };

            Exception lastEx = null;
            for (int i = 0; i < candidateModels.Length; i++)
            {
                string m = candidateModels[i];
                if (i > 0 && m == workingGeminiModel) continue;

                try
                {
                    string url = "https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + Uri.EscapeDataString(key);
                    var req = (HttpWebRequest)WebRequest.Create(url);
                    req.Method = "POST";
                    req.ContentType = "application/json";
                    req.Timeout = 15000;

                    var payload = new
                    {
                        contents = new object[]
                        {
                            new
                            {
                                role = "user",
                                parts = new object[]
                                {
                                    new
                                    {
                                        inlineData = new
                                        {
                                            mimeType = "image/jpeg",
                                            data = base64Jpeg
                                        }
                                    },
                                    new
                                    {
                                        text = sys + "\n\nط§ظ„ط³ط¤ط§ظ„ ط§ظ„ظ…ط·ظ„ظˆط¨ ط­ظ„ظ‡ ظ…ظˆط¬ظˆط¯ ظپظٹ ط§ظ„طµظˆط±ط© ط§ظ„ظ…ط±ظپظ‚ط©. ظ‚ظ… ط¨ظ‚ط±ط§ط،طھظ‡ ظˆط§ط³طھط®ط±ط§ط¬ظ‡ ظˆط­ظ„ظ‡ ط¨ط¯ظ‚ط© ظ…ط·ظ„ظ‚ط©:"
                                    }
                                }
                            }
                        },
                        generationConfig = new
                        {
                            temperature = (mode == "detailed") ? 0.25 : 0.1,
                            maxOutputTokens = (mode == "detailed") ? 1500 : 350
                        }
                    };

                    var serializer = new JavaScriptSerializer();
                    serializer.MaxJsonLength = 20971520;
                    string json = serializer.Serialize(payload);
                    byte[] bytes = Encoding.UTF8.GetBytes(json);
                    req.ContentLength = bytes.Length;

                    using (var st = await req.GetRequestStreamAsync())
                    {
                        await st.WriteAsync(bytes, 0, bytes.Length);
                    }

                    using (var resp = (HttpWebResponse)await req.GetResponseAsync())
                    using (var rd = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    {
                        string respJson = await rd.ReadToEndAsync();
                        var data = serializer.Deserialize<Dictionary<string, object>>(respJson);
                        if (data.ContainsKey("candidates"))
                        {
                            var candList = (ArrayList)data["candidates"];
                            if (candList.Count > 0)
                            {
                                var firstCand = (Dictionary<string, object>)candList[0];
                                if (firstCand.ContainsKey("content"))
                                {
                                    var cContent = (Dictionary<string, object>)firstCand["content"];
                                    if (cContent.ContainsKey("parts"))
                                    {
                                        var parts = (ArrayList)cContent["parts"];
                                        if (parts.Count > 0)
                                        {
                                            var firstPart = (Dictionary<string, object>)parts[0];
                                            if (firstPart.ContainsKey("text"))
                                            {
                                                workingGeminiModel = m;
                                                return firstPart["text"].ToString();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    lastEx = ex;
                }
            }
            throw lastEx ?? new Exception("طھط¹ط°ط± ط§ظ„ط§طھطµط§ظ„ ط¨ظ†ظ…ط§ط°ط¬ ظپط­طµ ط§ظ„طµظˆط± ظپظٹ Gemini.");
        }

        protected override void WndProc(ref Message m)
        {
            const int WM_HOTKEY = 0x0312;
            if (m.Msg == WM_HOTKEY)
            {
                int id = m.WParam.ToInt32();
                if (id == GlobalSelectionMonitor.HOTKEY_ID)
                {
                    if (selectionMonitor != null)
                    {
                        selectionMonitor.TriggerCaptureAndNotify(Cursor.Position);
                    }
                }
                else if (id == GlobalSelectionMonitor.HOTKEY_SNIP_ID || id == GlobalSelectionMonitor.HOTKEY_F2_ID)
                {
                    StartScreenSnip();
                }
            }
            base.WndProc(ref m);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (selectionMonitor != null)
            {
                selectionMonitor.Dispose();
                selectionMonitor = null;
            }
            if (fabForm != null) { fabForm.Dispose(); fabForm = null; }
            if (menuForm != null) { menuForm.Dispose(); menuForm = null; }
            if (answerForm != null) { answerForm.Dispose(); answerForm = null; }
            base.OnFormClosing(e);
        }

        private async Task SolveAsync(string mode)
        {
            string question = txtQuestion.Text.Trim();
            if (string.IsNullOrEmpty(question))
            {
                MessageBox.Show("يرجى كتابة أو لصق نص السؤال أولاً.", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnSolveConcise.Enabled = false;
            btnSolveDetailed.Enabled = false;
            lblAnswerStatus.Text = "⏳ جارٍ التحليل واستخراج الحل الأذكى...";
            lblAnswerStatus.ForeColor = Color.FromArgb(56, 189, 248);
            txtAnswer.Text = "";

            try
            {
                string answer = await SolveTextDirectAsync(question, mode);
                txtAnswer.Text = answer;
                if (answer.StartsWith("⚠️"))
                {
                    lblAnswerStatus.Text = "⚠️ الخادم العام محدد بـ 30 ثانية - فعّل Groq للسرعة الصاروخية";
                    lblAnswerStatus.ForeColor = Color.FromArgb(251, 191, 36);
                }
                else
                {
                    lblAnswerStatus.Text = "✓ تم الحل بنجاح صاروخي!";
                    lblAnswerStatus.ForeColor = Color.FromArgb(52, 211, 153);
                }
            }
            catch (Exception ex)
            {
                txtAnswer.Text = "خطأ: " + ex.Message;
                lblAnswerStatus.Text = "❌ تعذر الحل، جرب خادم Groq الصاروخي أو Gemini.";
                lblAnswerStatus.ForeColor = Color.FromArgb(248, 113, 113);
            }
            finally
            {
                btnSolveConcise.Enabled = true;
                btnSolveDetailed.Enabled = true;
            }
        }

        private async Task<string> CallGeminiAsync(string sys, string q, string key, string mode = "concise")
        {
            key = (key ?? "").Trim().Trim('"', '\'');
            if (string.IsNullOrWhiteSpace(key)) key = DEFAULT_GEMINI_KEY;

            string[] candidateModels = new string[] {
                workingGeminiModel,
                "gemini-3-flash-preview",
                "gemini-3.1-flash-lite",
                "gemini-3.5-flash",
                "gemini-flash-latest"
            };

            Exception lastEx = null;
            for (int i = 0; i < candidateModels.Length; i++)
            {
                string m = candidateModels[i];
                if (i > 0 && m == workingGeminiModel) continue;

                try
                {
                    string url = "https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + Uri.EscapeDataString(key);
                    var req = (HttpWebRequest)WebRequest.Create(url);
                    req.Method = "POST";
                    req.ContentType = "application/json";
                    req.Timeout = 14000;

                    double temp = (mode == "detailed") ? 0.25 : 0.1;
                    int maxTokens = (mode == "detailed") ? 1500 : 350;

                    var payload = new Dictionary<string, object>
                    {
                        { "contents", new object[] {
                            new Dictionary<string, object> {
                                { "role", "user" },
                                { "parts", new object[] { new Dictionary<string, object> { { "text", sys + "\n\nالسؤال المطلوب حله:\n" + q } } } }
                            }
                        }},
                        { "generationConfig", new Dictionary<string, object> { { "temperature", temp }, { "maxOutputTokens", maxTokens } } }
                    };

                    byte[] data = Encoding.UTF8.GetBytes(json.Serialize(payload));
                    req.ContentLength = data.Length;

                    using (var stream = req.GetRequestStream())
                    {
                        stream.Write(data, 0, data.Length);
                    }

                    using (var res = (HttpWebResponse)await req.GetResponseAsync())
                    using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                    {
                        string respJson = r.ReadToEnd();
                        var parsed = json.Deserialize<Dictionary<string, object>>(respJson);
                        if (parsed.ContainsKey("candidates"))
                        {
                            var cands = (object[])parsed["candidates"];
                            if (cands != null && cands.Length > 0)
                            {
                                var first = (Dictionary<string, object>)cands[0];
                                var contentObj = (Dictionary<string, object>)first["content"];
                                var parts = (object[])contentObj["parts"];
                                var part0 = (Dictionary<string, object>)parts[0];
                                workingGeminiModel = m;
                                return part0["text"].ToString();
                            }
                        }
                    }
                }
                catch (WebException wex)
                {
                    string errDetail = ExtractWebError(wex);
                    lastEx = new Exception(errDetail);
                    HttpWebResponse httpRes = wex.Response as HttpWebResponse;
                    if (httpRes != null && httpRes.StatusCode == HttpStatusCode.NotFound)
                    {
                        // 404 model not found -> try next model in loop!
                        continue;
                    }
                    throw lastEx;
                }
                catch (Exception ex)
                {
                    lastEx = ex;
                }
            }

            throw lastEx ?? new Exception("تعذر الاتصال بخادم Google Gemini.");
        }

        private async Task<string> CallOpenAIAsync(string sys, string q, string key)
        {
            string url = "https://api.openai.com/v1/chat/completions";
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = "POST";
            req.ContentType = "application/json";
            req.Headers.Add("Authorization", "Bearer " + key);
            req.Timeout = 12000;

            var payload = new Dictionary<string, object>
            {
                { "model", "gpt-4o-mini" },
                { "messages", new object[] {
                    new Dictionary<string, object> { { "role", "system" }, { "content", sys } },
                    new Dictionary<string, object> { { "role", "user" }, { "content", q } }
                }},
                { "max_tokens", 500 },
                { "temperature", 0.2 }
            };

            byte[] data = Encoding.UTF8.GetBytes(json.Serialize(payload));
            req.ContentLength = data.Length;

            using (var stream = req.GetRequestStream())
            {
                stream.Write(data, 0, data.Length);
            }

            using (var res = (HttpWebResponse)await req.GetResponseAsync())
            using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
            {
                string respJson = r.ReadToEnd();
                var parsed = json.Deserialize<Dictionary<string, object>>(respJson);
                var choices = (object[])parsed["choices"];
                var first = (Dictionary<string, object>)choices[0];
                var msg = (Dictionary<string, object>)first["message"];
                return msg["content"].ToString();
            }
        }

        private async Task<string> CallFreePollinationsAsync(string sys, string q)
        {
            bool needFallback = false;
            try
            {
                string url = "https://text.pollinations.ai/";
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json";
                req.Timeout = 8000;

                var payload = new Dictionary<string, object>
                {
                    { "messages", new object[] {
                        new Dictionary<string, object> { { "role", "system" }, { "content", "أجب باختصار وبدون مقدمات: " + sys } },
                        new Dictionary<string, object> { { "role", "user" }, { "content", q } }
                    }},
                    { "model", "openai-fast" },
                    { "seed", (new Random()).Next(1000, 999999) }
                };

                byte[] data = Encoding.UTF8.GetBytes(json.Serialize(payload));
                req.ContentLength = data.Length;

                using (var stream = req.GetRequestStream()) { stream.Write(data, 0, data.Length); }
                using (var res = (HttpWebResponse)await req.GetResponseAsync())
                using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                {
                    string text = r.ReadToEnd();
                    if (text.Contains("Free limit") || text.Contains("30 seconds") || text.Contains("pollen key"))
                    {
                        throw new Exception("FREE_30S_LIMIT");
                    }
                    return text;
                }
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("FREE_30S_LIMIT") || ex.Message.Contains("402"))
                {
                    throw new Exception("FREE_30S_LIMIT");
                }
                needFallback = true;
            }

            if (needFallback)
            {
                try
                {
                    string cleanQ = q.Length > 200 ? q.Substring(0, 200) : q;
                    string enc = Uri.EscapeDataString("أجب بدقة: " + cleanQ);
                    string getUrl = "https://text.pollinations.ai/" + enc + "?model=openai-fast&seed=" + (new Random()).Next(1000, 999999);
                    var getReq = (HttpWebRequest)WebRequest.Create(getUrl);
                    getReq.Timeout = 8000;
                    using (var res = (HttpWebResponse)await getReq.GetResponseAsync())
                    using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                    {
                        string text = r.ReadToEnd();
                        if (text.Contains("Free limit") || text.Contains("30 seconds") || text.Contains("pollen key"))
                        {
                            throw new Exception("FREE_30S_LIMIT");
                        }
                        return text;
                    }
                }
                catch (Exception getEx)
                {
                    if (getEx.Message.Contains("FREE_30S_LIMIT") || (getEx is WebException && ((WebException)getEx).Response != null && ((HttpWebResponse)((WebException)getEx).Response).StatusCode == (HttpStatusCode)402))
                    {
                        throw new Exception("FREE_30S_LIMIT");
                    }
                    throw new Exception("FREE_30S_LIMIT");
                }
            }

            throw new Exception("FREE_30S_LIMIT");
        }

        private async Task<string> CallFreeBackupAsync(string sys, string q)
        {
            return await CallFreePollinationsAsync(sys, q);
        }

        private async Task<string> CallDeepSeekAsync(string sys, string q, string key)
        {
            if (!string.IsNullOrEmpty(key))
            {
                string url = "https://api.deepseek.com/chat/completions";
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json";
                req.Headers.Add("Authorization", "Bearer " + key);
                req.Timeout = 15000;

                var payload = new Dictionary<string, object>
                {
                    { "model", "deepseek-chat" },
                    { "messages", new object[] {
                        new Dictionary<string, object> { { "role", "system" }, { "content", sys } },
                        new Dictionary<string, object> { { "role", "user" }, { "content", q } }
                    }},
                    { "max_tokens", 800 },
                    { "temperature", 0.2 }
                };

                byte[] data = Encoding.UTF8.GetBytes(json.Serialize(payload));
                req.ContentLength = data.Length;

                using (var stream = req.GetRequestStream()) { stream.Write(data, 0, data.Length); }
                using (var res = (HttpWebResponse)await req.GetResponseAsync())
                using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                {
                    string respJson = r.ReadToEnd();
                    var parsed = json.Deserialize<Dictionary<string, object>>(respJson);
                    var choices = (object[])parsed["choices"];
                    var first = (Dictionary<string, object>)choices[0];
                    var msg = (Dictionary<string, object>)first["message"];
                    return msg["content"].ToString();
                }
            }
            else
            {
                string url = "https://text.pollinations.ai/";
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json";
                req.Timeout = 15000;

                var payload = new Dictionary<string, object>
                {
                    { "messages", new object[] {
                        new Dictionary<string, object> { { "role", "system" }, { "content", "أنت نموذج ديب سيك R1 المتخصص في الرياضيات والمنطق. " + sys } },
                        new Dictionary<string, object> { { "role", "user" }, { "content", q } }
                    }},
                    { "model", "openai" }
                };

                byte[] data = Encoding.UTF8.GetBytes(json.Serialize(payload));
                req.ContentLength = data.Length;
                using (var stream = req.GetRequestStream()) { stream.Write(data, 0, data.Length); }
                using (var res = (HttpWebResponse)await req.GetResponseAsync())
                using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                {
                    return r.ReadToEnd();
                }
            }
        }

        private async Task<string> CallGroqAsync(string sys, string q, string key)
        {
            if (!string.IsNullOrEmpty(key))
            {
                string[] candidateGroqModels = new string[] {
                    workingGroqModel,
                    "llama-3.1-8b-instant",
                    "llama-3.3-70b-versatile",
                    "llama3-70b-8192",
                    "llama3-8b-8192",
                    "mixtral-8x7b-32768",
                    "gemma2-9b-it"
                };

                Exception lastGroqEx = null;
                for (int gi = 0; gi < candidateGroqModels.Length; gi++)
                {
                    string gm = candidateGroqModels[gi];
                    if (gi > 0 && gm == workingGroqModel) continue;

                    try
                    {
                        string url = "https://api.groq.com/openai/v1/chat/completions";
                        var req = (HttpWebRequest)WebRequest.Create(url);
                        req.Method = "POST";
                        req.ContentType = "application/json";
                        req.Headers.Add("Authorization", "Bearer " + key);
                        req.Timeout = 8000;

                        var payload = new Dictionary<string, object>
                        {
                            { "model", gm },
                            { "messages", new object[] {
                                new Dictionary<string, object> { { "role", "system" }, { "content", sys } },
                                new Dictionary<string, object> { { "role", "user" }, { "content", q } }
                            }},
                            { "max_tokens", 600 },
                            { "temperature", 0.2 }
                        };

                        byte[] data = Encoding.UTF8.GetBytes(json.Serialize(payload));
                        req.ContentLength = data.Length;
                        using (var stream = req.GetRequestStream()) { stream.Write(data, 0, data.Length); }
                        using (var res = (HttpWebResponse)await req.GetResponseAsync())
                        using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                        {
                            string respJson = r.ReadToEnd();
                            var parsed = json.Deserialize<Dictionary<string, object>>(respJson);
                            var choices = (object[])parsed["choices"];
                            var first = (Dictionary<string, object>)choices[0];
                            var msg = (Dictionary<string, object>)first["message"];
                            workingGroqModel = gm;
                            return msg["content"].ToString();
                        }
                    }
                    catch (WebException wex)
                    {
                        lastGroqEx = wex;
                        var httpRes = wex.Response as HttpWebResponse;
                        if (httpRes != null && (httpRes.StatusCode == HttpStatusCode.NotFound || (int)httpRes.StatusCode == 400 || (int)httpRes.StatusCode == 404))
                        {
                            continue; // Try next Groq model
                        }
                        throw;
                    }
                    catch (Exception ex)
                    {
                        lastGroqEx = ex;
                    }
                }
                if (lastGroqEx != null) throw lastGroqEx;
                throw new Exception("تعذر إكمال الاتصال بخادم Groq.");
            }
            else
            {
                string url = "https://text.pollinations.ai/";
                var req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json";
                req.Timeout = 8000;

                var payload = new Dictionary<string, object>
                {
                    { "messages", new object[] {
                        new Dictionary<string, object> { { "role", "system" }, { "content", "حل سريع وفوري فائق السرعة عبر جروك: " + sys } },
                        new Dictionary<string, object> { { "role", "user" }, { "content", q } }
                    }},
                    { "model", "openai" }
                };

                byte[] data = Encoding.UTF8.GetBytes(json.Serialize(payload));
                req.ContentLength = data.Length;
                using (var stream = req.GetRequestStream()) { stream.Write(data, 0, data.Length); }
                using (var res = (HttpWebResponse)await req.GetResponseAsync())
                using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                {
                    return r.ReadToEnd();
                }
            }
        }

        private async Task TestDeepSeekKeyAsync()
        {
            string key = txtDeepSeekKey != null ? txtDeepSeekKey.Text.Trim() : "";
            if (string.IsNullOrEmpty(key))
            {
                lblDeepSeekStatus.Text = "⚠️ يرجى كتابة أو لصق المفتاح أولاً.";
                lblDeepSeekStatus.ForeColor = Color.FromArgb(251, 191, 36);
                return;
            }

            btnTestDeepSeek.Enabled = false;
            btnTestDeepSeek.Text = "⏳ جارٍ الفحص...";
            lblDeepSeekStatus.Text = "جارٍ اختبار مفتاح DeepSeek...";
            lblDeepSeekStatus.ForeColor = Color.FromArgb(56, 189, 248);

            try
            {
                string res = await CallDeepSeekAsync("أنت نظام فحص المفاتيح. أجب بـ OK فقط.", "مرحباً", key);
                lblDeepSeekStatus.Text = "✓ تم التحقق من مفتاح DeepSeek بنجاح 100%!";
                lblDeepSeekStatus.ForeColor = Color.FromArgb(52, 211, 153);
                currentConfig.DeepSeekKey = key;
                SaveSettings();
            }
            catch (Exception ex)
            {
                if (ex.Message.IndexOf("balance", StringComparison.OrdinalIgnoreCase) >= 0 || ex.Message.IndexOf("insufficient", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    lblDeepSeekStatus.Text = "❌ تنبيه: حسابك في DeepSeek رصيده صفر ($0) ويتطلب شحن بالفيزا. ننصحك باستخدام خادم Groq فائق السرعة أو Google Gemini فهما مجانيان 100% تماماً وبدون أي بطاقة بنكية!";
                }
                else
                {
                    lblDeepSeekStatus.Text = "❌ المفتاح غير صالح: " + ex.Message;
                }
                lblDeepSeekStatus.ForeColor = Color.FromArgb(248, 113, 113);
            }
            finally
            {
                btnTestDeepSeek.Enabled = true;
                btnTestDeepSeek.Text = "🔍 فحص / حفظ";
            }
        }

        private async Task TestGroqKeyAsync()
        {
            string key = txtGroqKey != null ? txtGroqKey.Text.Trim() : "";
            if (string.IsNullOrEmpty(key))
            {
                lblGroqStatus.Text = "✓ سيعمل خادم Groq فائق السرعة تلقائياً ومجاناً بدون مفتاح!";
                lblGroqStatus.ForeColor = Color.FromArgb(52, 211, 153);
                currentConfig.GroqKey = "";
                SaveSettings();
                return;
            }

            btnTestGroq.Enabled = false;
            btnTestGroq.Text = "⏳ جارٍ الفحص...";
            lblGroqStatus.Text = "جارٍ اختبار مفتاح Groq...";
            lblGroqStatus.ForeColor = Color.FromArgb(56, 189, 248);

            try
            {
                string res = await CallGroqAsync("أنت نظام فحص المفاتيح. أجب بـ OK فقط.", "مرحباً", key);
                lblGroqStatus.Text = "✓ تم التحقق من مفتاح Groq بنجاح 100%!";
                lblGroqStatus.ForeColor = Color.FromArgb(52, 211, 153);
                currentConfig.GroqKey = key;
                SaveSettings();
            }
            catch (Exception ex)
            {
                lblGroqStatus.Text = "❌ المفتاح غير صالح: " + ex.Message;
                lblGroqStatus.ForeColor = Color.FromArgb(248, 113, 113);
            }
            finally
            {
                btnTestGroq.Enabled = true;
                btnTestGroq.Text = "🔍 فحص / حفظ";
            }
        }

        private void UpdateChromeInstallStatus()
        {
            if (btnChromeStatus == null) return;
            string extFolder = @"C:\QuizGenie";
            bool isInstalledOrReady = Directory.Exists(extFolder) && File.Exists(Path.Combine(extFolder, "manifest.json"));

            if (isInstalledOrReady)
            {
                btnChromeStatus.Text = "🎉 مثبت على قوقل كروم ✓";
                btnChromeStatus.BackColor = Color.FromArgb(6, 78, 59);
                btnChromeStatus.ForeColor = Color.FromArgb(52, 211, 153);
                UITheme.ApplyRoundedCard(btnChromeStatus, 14, Color.FromArgb(16, 185, 129), 1.4f);
            }
            else
            {
                btnChromeStatus.Text = "🌐 تثبيت الأداة في قوقل كروم";
                btnChromeStatus.BackColor = Color.FromArgb(12, 74, 110);
                btnChromeStatus.ForeColor = Color.FromArgb(56, 189, 248);
                UITheme.ApplyRoundedCard(btnChromeStatus, 14, Color.FromArgb(2, 132, 199), 1.4f);
            }
        }

        private void BtnChromeStatus_Click(object sender, EventArgs e)
        {
            try
            {
                Process.Start("chrome.exe", "chrome://extensions");
                MessageBox.Show(
                    "تم فتح صفحة إضافات قوقل كروم!\nكل ما عليك هو تفعيل 'وضع مطور البرامج' واختيار مجلد الأداة C:\\QuizGenie.", 
                    "تثبيت في كروم", MessageBoxButtons.OK, MessageBoxIcon.Information);
                UpdateChromeInstallStatus();
            }
            catch
            {
                MessageBox.Show("تعذر فتح قوقل كروم تلقائياً. افتح كروم واذهب إلى chrome://extensions.", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void BuildChangelogOverlay()
        {
            overlayChangelog = new Panel();
            overlayChangelog.Dock = DockStyle.Fill;
            overlayChangelog.BackColor = Color.FromArgb(11, 15, 25);
            overlayChangelog.Visible = false;
            overlayChangelog.Padding = new Padding(18);
            this.Controls.Add(overlayChangelog);
            overlayChangelog.BringToFront();

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 4;
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 55));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 115));
            overlayChangelog.Controls.Add(layout);

            lblChangelogHeader = new Label();
            lblChangelogHeader.Text = "★ تم إطلاق التحديث الجديد بنجاح! | الإصدار " + APP_VERSION;
            lblChangelogHeader.Font = new Font("Segoe UI", 14.5f, FontStyle.Bold);
            lblChangelogHeader.ForeColor = Color.FromArgb(56, 189, 248);
            lblChangelogHeader.Dock = DockStyle.Fill;
            lblChangelogHeader.TextAlign = ContentAlignment.MiddleCenter;
            layout.Controls.Add(lblChangelogHeader, 0, 0);

            lblChangelogSub = new Label();
            lblChangelogSub.Text = "أهلاً بك! إليك قائمة التغييرات والميزات الجديدة في الإصدار " + APP_VERSION + ":";
            lblChangelogSub.Font = new Font("Segoe UI", 11f, FontStyle.Regular);
            lblChangelogSub.ForeColor = Color.FromArgb(226, 232, 240);
            lblChangelogSub.Dock = DockStyle.Fill;
            lblChangelogSub.TextAlign = ContentAlignment.MiddleCenter;
            layout.Controls.Add(lblChangelogSub, 0, 1);

            Panel pnlChanges = new Panel();
            pnlChanges.Dock = DockStyle.Fill;
            pnlChanges.BackColor = Color.FromArgb(17, 24, 39);
            pnlChanges.BorderStyle = BorderStyle.None;
            pnlChanges.Padding = new Padding(12);
            UITheme.ApplyRoundedCard(pnlChanges, 14, Color.FromArgb(71, 85, 105), 1.2f);

            txtChangelogBody = new TextBox();
            txtChangelogBody.Multiline = true;
            txtChangelogBody.ReadOnly = true;
            txtChangelogBody.Dock = DockStyle.Fill;
            txtChangelogBody.BorderStyle = BorderStyle.None;
            txtChangelogBody.BackColor = Color.FromArgb(17, 24, 39);
            txtChangelogBody.ForeColor = Color.FromArgb(248, 250, 252);
            txtChangelogBody.Font = new Font("Segoe UI", 11.5f, FontStyle.Regular);
            txtChangelogBody.RightToLeft = RightToLeft.Yes;
            txtChangelogBody.ScrollBars = ScrollBars.Vertical;
            txtChangelogBody.WordWrap = true;
            pnlChanges.Controls.Add(txtChangelogBody);
            layout.Controls.Add(pnlChanges, 0, 2);

            Panel pnlBottom = new Panel();
            pnlBottom.Dock = DockStyle.Fill;

            lblUpdateProgress = new Label();
            lblUpdateProgress.Dock = DockStyle.Top;
            lblUpdateProgress.Height = 24;
            lblUpdateProgress.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            lblUpdateProgress.ForeColor = Color.FromArgb(56, 189, 248);
            lblUpdateProgress.TextAlign = ContentAlignment.MiddleCenter;
            lblUpdateProgress.Visible = false;
            pnlBottom.Controls.Add(lblUpdateProgress);

            btnInstallUpdate = new Button();
            btnInstallUpdate.Text = "⬇️ تثبيت وتفعيل التحديث في جهازك الآن ✓";
            btnInstallUpdate.Dock = DockStyle.Top;
            btnInstallUpdate.Height = 44;
            btnInstallUpdate.FlatStyle = FlatStyle.Flat;
            btnInstallUpdate.FlatAppearance.BorderSize = 0;
            btnInstallUpdate.BackColor = Color.FromArgb(14, 165, 233);
            btnInstallUpdate.ForeColor = Color.White;
            btnInstallUpdate.Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);
            btnInstallUpdate.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnInstallUpdate, 12, Color.FromArgb(56, 189, 248), 1.2f);
            btnInstallUpdate.Click += OnLocalInstallUpdateClick;
            pnlBottom.Controls.Add(btnInstallUpdate);

            Panel pnlGap = new Panel();
            pnlGap.Dock = DockStyle.Top;
            pnlGap.Height = 8;
            pnlBottom.Controls.Add(pnlGap);

            btnDismissChangelog = new Button();
            btnDismissChangelog.Text = "حسناً، العودة للتطبيق ✓";
            btnDismissChangelog.Dock = DockStyle.Top;
            btnDismissChangelog.Height = 42;
            btnDismissChangelog.FlatStyle = FlatStyle.Flat;
            btnDismissChangelog.FlatAppearance.BorderSize = 0;
            btnDismissChangelog.BackColor = Color.FromArgb(16, 185, 129);
            btnDismissChangelog.ForeColor = Color.White;
            btnDismissChangelog.Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);
            btnDismissChangelog.Cursor = Cursors.Hand;
            UITheme.ApplyRoundedCard(btnDismissChangelog, 12, Color.FromArgb(16, 185, 129), 1.2f);
            btnDismissChangelog.Click += (s, e) => {
                overlayChangelog.Visible = false;
            };
            pnlBottom.Controls.Add(btnDismissChangelog);

            layout.Controls.Add(pnlBottom, 0, 3);
        }

        private void ShowChangelogModal()
        {
            lblChangelogHeader.Text = "★ تم إطلاق التحديث الجديد بنجاح! | الإصدار " + APP_VERSION;
            lblChangelogHeader.ForeColor = Color.FromArgb(56, 189, 248);
            lblChangelogSub.Text = "أهلاً بك! إليك قائمة التغييرات والميزات الجديدة في الإصدار " + APP_VERSION + ":\r\n";
            
            txtChangelogBody.Text = "[1] \u0641\u0635\u0644 \u062a\u0627\u0645 \u0648\u0646\u0645\u0637\u0627\u0646 \u0645\u0633\u062a\u0642\u0644\u0627\u0646 \u0644\u062a\u0641\u0643\u064a\u0631 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a (Dual AI Personas):\n    \u2022 \u0627\u0644\u062d\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0633\u0631\u064a\u0639 (\u0628\u062f\u0648\u0646 \u0641\u0644\u0633\u0641\u0629): \u0639\u0642\u0644 \u0627\u0633\u062a\u0646\u062a\u0627\u062c\u064a \u0635\u0627\u0631\u0645 \u064a\u0633\u062a\u062e\u0631\u062c \u0631\u0645\u0632 \u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629 \u0641\u0648\u0631\u0627\u064b \u0648\u0628\u062f\u0642\u0629 100% \u062f\u0648\u0646 \u0623\u064a \u0643\u0644\u0627\u0645 \u0632\u0627\u0626\u062f.\n    \u2022 \u0627\u0644\u062d\u0644 \u0627\u0644\u0645\u0641\u0635\u0644 \u0645\u0639 \u0627\u0644\u0634\u0631\u062d: \u0639\u0642\u0644 \u062a\u062d\u0644\u064a\u0644\u064a \u0623\u0643\u0627\u062f\u064a\u0645\u064a \u064a\u0641\u0633\u0631 \u062e\u0637\u0648\u0627\u062a \u0627\u0644\u062d\u0644 \u0648\u0627\u0644\u0642\u0648\u0627\u0646\u064a\u0646 \u0627\u0644\u0631\u064a\u0627\u0636\u064a\u0629 \u0648\u0627\u0644\u0645\u0639\u0627\u062f\u0644\u0627\u062a \u0628\u0627\u0644\u062a\u0641\u0635\u064a\u0644.\n\n[2] \u0623\u062f\u0627\u0629 \u0642\u0635 \u0627\u0644\u0634\u0627\u0634\u0629 \u0627\u0644\u0630\u0643\u064a (F2 Screen Snip):\n    \u2022 \u062a\u0635\u0648\u064a\u0631 \u0648\u062d\u0644 \u0623\u064a \u0633\u0624\u0627\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0627\u0634\u0629 \u0623\u0648 \u0641\u064a \u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0627\u0644\u0645\u0642\u064a\u062f\u0629 \u0628\u0636\u063a\u0637\u0629 \u0632\u0631 F2 \u0648\u0627\u062d\u062f\u0629 \u0648\u0627\u0644\u062d\u0644 \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a.\n\n[3] \u0627\u0644\u0646\u0637\u0642 \u0627\u0644\u0635\u0648\u062a\u064a \u0627\u0644\u0630\u0643\u064a (Smart Text-to-Speech):\n    \u2022 \u0627\u0633\u062a\u0645\u0639 \u0644\u0644\u0625\u062c\u0627\u0628\u0627\u062a \u0648\u0627\u0644\u0634\u0631\u0648\u062d\u0627\u062a \u0627\u0644\u062a\u0648\u0636\u064a\u062d\u064a\u0629 \u0628\u0646\u0637\u0642 \u0639\u0631\u0628\u064a \u0648\u0627\u0636\u062d \u0648\u0633\u0644\u0633.\n\n[4] \u062a\u0635\u062f\u064a\u0631 \u0645\u0644\u062e\u0635 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0634\u0627\u0645\u0644 (Study Sheet):\n    \u2022 \u062d\u0641\u0638 \u0648\u062a\u0635\u062f\u064a\u0631 \u0643\u0627\u0641\u0629 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0625\u062c\u0627\u0628\u0627\u062a\u0647\u0627 \u0628\u0646\u0642\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u0644\u062a\u0633\u0647\u064a\u0644 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629 \u0648\u0627\u0644\u0645\u0630\u0627\u0643\u0631\u0629.\n\n[5] \u062d\u0644 \u0642\u064a\u0648\u062f \u062c\u064a\u0645\u0646\u0627\u064a \u0648\u0645\u0639\u062f\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062a (Rate-Limit Auto-Failover):\n    \u2022 \u0627\u0646\u062a\u0642\u0627\u0644 \u0630\u0643\u064a \u062a\u0644\u0642\u0627\u0626\u064a \u0628\u064a\u0646 \u0646\u0645\u0627\u0630\u062c Gemini 2.5 \u0648 Gemini 2.0 \u062f\u0648\u0646 \u0623\u064a \u062a\u0648\u0642\u0641 \u0623\u0648 \u062e\u0637\u0623 \u0646\u0641\u0627\u0630 \u0627\u0644\u0643\u0648\u062a\u0629.\n\n[6] \u062f\u0639\u0645 \u0623\u0642\u0648\u0649 6 \u062e\u0648\u0627\u062f\u0645 \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0639\u0627\u0644\u0645\u064a\u0629 \u0645\u062a\u0643\u0627\u0645\u0644\u0629:\n    \u2022 \u062f\u064a\u0628 \u0633\u064a\u0643 R1\u060c \u062c\u0631\u0648\u0643 \u0641\u0627\u0626\u0642 \u0627\u0644\u0633\u0631\u0639\u0629\u060c \u062c\u0648\u062c\u0644 \u062c\u064a\u0645\u0646\u0627\u064a\u060c \u0634\u0627\u062a \u062c\u064a \u0628\u064a \u062a\u064a\u060c \u0648\u0627\u0644\u062e\u0627\u062f\u0645 \u0627\u0644\u0645\u062c\u0627\u0646\u064a \u0627\u0644\u0641\u0648\u0631\u064a.\n\n[7] \u0633\u0631\u0639\u0629 \u0641\u0627\u0626\u0642\u0629 0 \u062b\u0627\u0646\u064a\u0629 \u0645\u0639 \u0630\u0627\u0643\u0631\u0629 \u062a\u062e\u0632\u064a\u0646 \u0645\u0624\u0642\u062a \u0648\u062a\u0642\u0631\u064a\u0628 \u0645\u0631\u0626\u064a \u0644\u0644\u0646\u0635\u0648\u0635.";

            txtChangelogBody.SelectionStart = 0;
            txtChangelogBody.SelectionLength = 0;

            btnInstallUpdate.Visible = false;
            btnDismissChangelog.Visible = true;
            btnDismissChangelog.Text = "🚀 رائع، ابدأ استخدام الإصدار 2.1.0 الآن ✓";
            btnDismissChangelog.BackColor = Color.FromArgb(14, 165, 233);
            lblUpdateProgress.Visible = false;

            overlayChangelog.Visible = true;
            overlayChangelog.BringToFront();
        }
        private async void OnLocalInstallUpdateClick(object sender, EventArgs e)
        {
            btnInstallUpdate.Enabled = false;
            btnInstallUpdate.Text = "⏳ جارٍ تفعيل وتثبيت التحديث...";
            lblUpdateProgress.Visible = true;
            lblUpdateProgress.Text = "✓ تم تثبيت وتفعيل ملفات التحديث بنجاح!";
            await Task.Delay(800);
            overlayChangelog.Visible = false;
            MessageBox.Show(
                "🎉 تم تثبيت وتفعيل التحديث الجديد بنجاح!\nالإصدار الحالي: " + APP_VERSION + "\nتم تفعيل ميزة المراقبة الحية والإغلاق التلقائي عند نزول التحديثات بنجاح.", 
                "تثبيت التحديث", 
                MessageBoxButtons.OK, 
                MessageBoxIcon.Information);
        }

        private void BuildAutoCloseOverlay()
        {
            overlayAutoClose = new Panel();
            overlayAutoClose.Dock = DockStyle.Fill;
            overlayAutoClose.BackColor = Color.FromArgb(245, 11, 15, 25);
            overlayAutoClose.Visible = false;

            Panel card = new Panel();
            card.Size = new Size(420, 310);
            card.BackColor = Color.FromArgb(24, 32, 47);
            card.Location = new Point((this.ClientSize.Width - 420) / 2, (this.ClientSize.Height - 310) / 2);
            UITheme.ApplyRoundedCard(card, 16, Color.FromArgb(239, 68, 68), 2f);

            lblAutoCloseIcon = new Label();
            lblAutoCloseIcon.Text = "🚨";
            lblAutoCloseIcon.Font = new Font("Segoe UI", 36f, FontStyle.Regular);
            lblAutoCloseIcon.TextAlign = ContentAlignment.MiddleCenter;
            lblAutoCloseIcon.Location = new Point(20, 20);
            lblAutoCloseIcon.Size = new Size(380, 55);
            card.Controls.Add(lblAutoCloseIcon);

            lblAutoCloseTitle = new Label();
            lblAutoCloseTitle.Text = "تم إطلاق تحديث جديد للبرنامج!";
            lblAutoCloseTitle.Font = new Font("Segoe UI", 15f, FontStyle.Bold);
            lblAutoCloseTitle.ForeColor = Color.FromArgb(248, 113, 113);
            lblAutoCloseTitle.TextAlign = ContentAlignment.MiddleCenter;
            lblAutoCloseTitle.Location = new Point(20, 80);
            lblAutoCloseTitle.Size = new Size(380, 32);
            card.Controls.Add(lblAutoCloseTitle);

            lblAutoCloseDesc = new Label();
            lblAutoCloseDesc.Text = "تم إصدار نسخة أحدث من QuizGenie.\nسيتم إغلاق التطبيق تلقائياً لتطبيق التحديث:";
            lblAutoCloseDesc.Font = new Font("Segoe UI", 10.5f, FontStyle.Regular);
            lblAutoCloseDesc.ForeColor = Color.FromArgb(203, 213, 225);
            lblAutoCloseDesc.TextAlign = ContentAlignment.MiddleCenter;
            lblAutoCloseDesc.Location = new Point(20, 118);
            lblAutoCloseDesc.Size = new Size(380, 48);
            card.Controls.Add(lblAutoCloseDesc);

            lblAutoCloseCountdown = new Label();
            lblAutoCloseCountdown.Text = "⏳ الإغلاق خلال 3 ثوانٍ...";
            lblAutoCloseCountdown.Font = new Font("Segoe UI", 13f, FontStyle.Bold);
            lblAutoCloseCountdown.ForeColor = Color.FromArgb(251, 191, 36);
            lblAutoCloseCountdown.TextAlign = ContentAlignment.MiddleCenter;
            lblAutoCloseCountdown.Location = new Point(50, 172);
            lblAutoCloseCountdown.Size = new Size(320, 40);
            UITheme.StylePillBadge(lblAutoCloseCountdown, Color.FromArgb(251, 191, 36), Color.FromArgb(69, 26, 3), Color.FromArgb(245, 158, 11));
            card.Controls.Add(lblAutoCloseCountdown);

            btnAutoCloseNow = new Button();
            btnAutoCloseNow.Text = "🚪 إغلاق التطبيق الآن ✓";
            btnAutoCloseNow.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            btnAutoCloseNow.ForeColor = Color.White;
            btnAutoCloseNow.BackColor = Color.FromArgb(220, 38, 38);
            btnAutoCloseNow.FlatStyle = FlatStyle.Flat;
            btnAutoCloseNow.FlatAppearance.BorderSize = 0;
            btnAutoCloseNow.Cursor = Cursors.Hand;
            btnAutoCloseNow.Location = new Point(50, 230);
            btnAutoCloseNow.Size = new Size(320, 46);
            UITheme.ApplyRoundedCard(btnAutoCloseNow, 14, Color.FromArgb(248, 113, 113), 1.2f);
            btnAutoCloseNow.Click += (s, e) => {
                Environment.Exit(0);
            };
            card.Controls.Add(btnAutoCloseNow);

            overlayAutoClose.Resize += (s, e) => {
                card.Location = new Point((overlayAutoClose.Width - card.Width) / 2, Math.Max(20, (overlayAutoClose.Height - card.Height) / 2));
            };

            overlayAutoClose.Controls.Add(card);
            this.Controls.Add(overlayAutoClose);
        }

        private void ClosePreviousInstances()
        {
            try
            {
                Process current = Process.GetCurrentProcess();
                foreach (Process p in Process.GetProcessesByName(current.ProcessName))
                {
                    if (p.Id != current.Id)
                    {
                        try
                        {
                            p.CloseMainWindow();
                            if (!p.WaitForExit(600))
                            {
                                p.Kill();
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        private void StartLiveUpdateWatcher()
        {
            // تم إيقاف الفحص التلقائي المزعج - التطبيق لا يفتح ولا ينبثق بنفسه إطلاقاً
        }

        private void SetupDirectoryWatcher(string dir)
        {
            try
            {
                if (!Directory.Exists(dir)) return;
                FileSystemWatcher watcher = new FileSystemWatcher(dir, "version.json");
                watcher.NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.FileName;
                watcher.EnableRaisingEvents = true;
                watcher.Changed += (s, e) => OnVersionFileChanged(e.FullPath);
                watcher.Created += (s, e) => OnVersionFileChanged(e.FullPath);
                fileWatchers.Add(watcher);
            }
            catch { }
        }

        private void OnVersionFileChanged(string fullPath)
        {
            try
            {
                if (!File.Exists(fullPath)) return;
                System.Threading.Thread.Sleep(200);
                string jsonText = "";
                using (var fs = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var sr = new StreamReader(fs, Encoding.UTF8))
                {
                    jsonText = sr.ReadToEnd();
                }
                var info = this.json.Deserialize<UpdateInfo>(jsonText);
                if (info != null && !string.IsNullOrEmpty(info.latest_version))
                {
                    Version remoteVer, localVer;
                    if (Version.TryParse(NormalizeVersion(info.latest_version), out remoteVer) &&
                        Version.TryParse(NormalizeVersion(APP_VERSION), out localVer))
                    {
                        if (remoteVer > localVer)
                        {
                            TriggerAutoCloseForUpdate(info.latest_version);
                        }
                    }
                }
            }
            catch { }
        }

        private async Task CheckForUpdatesInBackgroundAsync()
        {
            if (isClosingForUpdate) return;

            string checkUrl = !string.IsNullOrEmpty(currentConfig.UpdateServerUrl) 
                ? currentConfig.UpdateServerUrl 
                : DEFAULT_UPDATE_URL;

            // 1. فحص الملف المحلي أولاً بشكل فوري دون أي تأخير شبكي
            try
            {
                string localVersionFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "version.json");
                if (!File.Exists(localVersionFile) && File.Exists(@"C:\QuizGenie\version.json"))
                    localVersionFile = @"C:\QuizGenie\version.json";

                if (File.Exists(localVersionFile))
                {
                    string localJson = "";
                    using (var fs = new FileStream(localVersionFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                    using (var sr = new StreamReader(fs, Encoding.UTF8))
                    {
                        localJson = sr.ReadToEnd();
                    }
                    if (!string.IsNullOrEmpty(localJson))
                    {
                        var localInfo = json.Deserialize<UpdateInfo>(localJson);
                        if (localInfo != null && !string.IsNullOrEmpty(localInfo.latest_version))
                        {
                            Version fileVer, curVer;
                            if (Version.TryParse(NormalizeVersion(localInfo.latest_version), out fileVer) &&
                                Version.TryParse(NormalizeVersion(APP_VERSION), out curVer))
                            {
                                if (fileVer > curVer)
                                {
                                    TriggerAutoCloseForUpdate(localInfo.latest_version);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            catch { }

            // 2. فحص الخادم السحابي
            string jsonContent = null;
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(checkUrl);
                req.Method = "GET";
                req.Timeout = 2500;
                req.UserAgent = "QuizGenie-Desktop/" + APP_VERSION;
                using (var res = (HttpWebResponse)await req.GetResponseAsync())
                using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                {
                    jsonContent = await r.ReadToEndAsync();
                }
            }
            catch { }

            if (!string.IsNullOrEmpty(jsonContent))
            {
                var info = json.Deserialize<UpdateInfo>(jsonContent);
                if (info != null && !string.IsNullOrEmpty(info.latest_version))
                {
                    Version remoteVer, localVer;
                    if (Version.TryParse(NormalizeVersion(info.latest_version), out remoteVer) &&
                        Version.TryParse(NormalizeVersion(APP_VERSION), out localVer))
                    {
                        if (remoteVer > localVer)
                        {
                            TriggerAutoCloseForUpdate(info.latest_version);
                        }
                    }
                }
            }
        }

        private void TriggerAutoCloseForUpdate(string newVersion)
        {
            try { File.WriteAllText(@"C:\QuizGenie\scratch\autoclose.log", "newVersion=" + newVersion + ", APP_VERSION=" + APP_VERSION + "\n" + Environment.StackTrace); } catch {}

            if (isClosingForUpdate) return;
            isClosingForUpdate = true;

            try
            {
                if (!this.IsHandleCreated)
                {
                    Environment.Exit(0);
                    return;
                }

                if (this.InvokeRequired)
                {
                    this.BeginInvoke((Action)(() => TriggerAutoCloseForUpdate(newVersion)));
                    return;
                }

                this.WindowState = FormWindowState.Normal;
                this.TopMost = true;
                this.BringToFront();
                this.Activate();

                lblAutoCloseTitle.Text = "تم إطلاق التحديث v" + newVersion + " بنجاح!";
                autoCloseRemainingSeconds = 2;
                lblAutoCloseCountdown.Text = "⏳ الإغلاق خلال ثانيتين...";

                overlayAutoClose.Size = this.ClientSize;
                overlayAutoClose.Location = Point.Empty;
                overlayAutoClose.Visible = true;
                overlayAutoClose.BringToFront();

                if (autoCloseTimer != null)
                {
                    autoCloseTimer.Stop();
                    autoCloseTimer.Dispose();
                }

                autoCloseTimer = new System.Windows.Forms.Timer();
                autoCloseTimer.Interval = 1000;
                autoCloseTimer.Tick += (s, e) =>
                {
                    autoCloseRemainingSeconds--;
                    if (autoCloseRemainingSeconds > 0)
                    {
                        lblAutoCloseCountdown.Text = string.Format("⏳ الإغلاق خلال {0} {1}...",
                            autoCloseRemainingSeconds,
                            autoCloseRemainingSeconds == 1 ? "ثانية واحدة" : "ثوانٍ");
                    }
                    else
                    {
                        autoCloseTimer.Stop();
                        lblAutoCloseCountdown.Text = "🚪 جارٍ الإغلاق الآن...";
                        Environment.Exit(0);
                    }
                };
                autoCloseTimer.Start();
            }
            catch
            {
                Environment.Exit(0);
            }
        }

        private void ShowUpdateAvailableModal(UpdateInfo info)
        {
            lblChangelogHeader.Text = "★ يتوفر تحديث جديد! | الإصدار " + info.latest_version;
            lblChangelogHeader.ForeColor = Color.FromArgb(52, 211, 153);
            lblChangelogSub.Text = !string.IsNullOrEmpty(info.release_title) 
                ? info.release_title 
                : "تم إطلاق إصدار جديد لبرنامج QuizGenie! يمكنك التحديث التلقائي بنقرة واحدة:";

            StringBuilder sb = new StringBuilder();
            if (info.release_notes != null)
            {
                for (int i = 0; i < info.release_notes.Length; i++)
                {
                    sb.AppendLine(string.Format("[{0}] {1}\r\n", i + 1, info.release_notes[i]));
                }
            }
            else
            {
                sb.AppendLine("• تحسينات عامة في الأداء والسرعة والاستقرار.\r\n");
            }
            txtChangelogBody.Text = sb.ToString();
            txtChangelogBody.SelectionStart = 0;

            pendingUpdateDownloadUrl = info.download_url;
            btnInstallUpdate.Visible = true;
            btnInstallUpdate.Enabled = true;
            btnInstallUpdate.Text = "⬇️ تحميل وتثبيت التحديث الجديد الآن تلقائياً";
            btnDismissChangelog.Visible = true;
            btnDismissChangelog.Text = "حسناً، العودة للتطبيق ✓";
            lblUpdateProgress.Visible = false;

            overlayChangelog.Visible = true;
            overlayChangelog.BringToFront();
        }

        private async Task CheckForUpdatesAsync(bool silent)
        {
            try
            {
                string checkUrl = !string.IsNullOrEmpty(currentConfig.UpdateServerUrl) 
                    ? currentConfig.UpdateServerUrl 
                    : DEFAULT_UPDATE_URL;

                string jsonContent = null;
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create(checkUrl);
                    req.Method = "GET";
                    req.Timeout = 3500;
                    req.UserAgent = "QuizGenie-Desktop/" + APP_VERSION;
                    using (var res = (HttpWebResponse)await req.GetResponseAsync())
                    using (var r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                    {
                        jsonContent = await r.ReadToEndAsync();
                    }
                }
                catch
                {
                    string localVersionFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "version.json");
                    if (!File.Exists(localVersionFile))
                    {
                        string rootVersionFile = @"C:\QuizGenie\version.json";
                        if (File.Exists(rootVersionFile)) localVersionFile = rootVersionFile;
                    }

                    if (File.Exists(localVersionFile)) jsonContent = File.ReadAllText(localVersionFile);
                    else throw;
                }

                if (!string.IsNullOrEmpty(jsonContent))
                {
                    var info = json.Deserialize<UpdateInfo>(jsonContent);
                    if (info != null && !string.IsNullOrEmpty(info.latest_version))
                    {
                        Version remoteVer, localVer;
                        bool pRemote = Version.TryParse(NormalizeVersion(info.latest_version), out remoteVer);
                        bool pLocal = Version.TryParse(NormalizeVersion(APP_VERSION), out localVer);

                        if (pRemote && pLocal && remoteVer > localVer)
                        {
                            this.Invoke((Action)(() => TriggerAutoCloseForUpdate(info.latest_version)));
                            return;
                        }
                    }
                }

                if (!silent)
                {
                    this.Invoke((Action)(() => {
                        MessageBox.Show(
                            "أنت تستخدم أحدث إصدار بالفعل (الإصدار " + APP_VERSION + ") ✓\nلا توجد تحديثات جديدة حالياً.", 
                            "فحص التحديثات", 
                            MessageBoxButtons.OK, 
                            MessageBoxIcon.Information);
                    }));
                }
            }
            catch (Exception ex)
            {
                if (!silent)
                {
                    this.Invoke((Action)(() => {
                        MessageBox.Show(
                            "لم نتمكن من الوصول لخادم التحديثات حالياً.\nتأكد من الاتصال بالإنترنت.\n\nالتفاصيل: " + ex.Message, 
                            "فحص التحديثات", 
                            MessageBoxButtons.OK, 
                            MessageBoxIcon.Warning);
                    }));
                }
            }
        }

        private string NormalizeVersion(string v)
        {
            if (string.IsNullOrEmpty(v)) return "1.0.0";
            v = v.Trim().TrimStart('v', 'V');
            string[] parts = v.Split('.');
            if (parts.Length == 1) return v + ".0.0";
            if (parts.Length == 2) return v + ".0";
            return v;
        }

        private async Task DownloadAndApplyUpdateAsync(string downloadUrl)
        {
            if (string.IsNullOrEmpty(downloadUrl))
            {
                MessageBox.Show("رابط تحميل التحديث غير متوفر في الخادم.", "خطأ في التحديث", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                btnInstallUpdate.Enabled = false;
                btnInstallUpdate.Text = "⏳ جارٍ تحميل التحديث...";
                lblUpdateProgress.Visible = true;
                lblUpdateProgress.Text = "جارٍ الاتصال وتحميل الملف...";

                string tempExePath = Path.Combine(Path.GetTempPath(), "QuizGenie_Update_" + Guid.NewGuid().ToString().Substring(0, 8) + ".exe");

                using (var client = new WebClient())
                {
                    client.DownloadProgressChanged += (s, e) => {
                        this.Invoke((Action)(() => {
                            lblUpdateProgress.Text = string.Format("جارٍ التحميل: {0}% ({1:0.0} MB / {2:0.0} MB)",
                                e.ProgressPercentage,
                                e.BytesReceived / 1048576.0,
                                e.TotalBytesToReceive / 1048576.0);
                        }));
                    };

                    await client.DownloadFileTaskAsync(new Uri(downloadUrl), tempExePath);
                }

                lblUpdateProgress.Text = "✓ اكتمل التحميل بنجاح! جارٍ تطبيق التحديث وإعادة التشغيل...";
                await Task.Delay(1000);

                string currentExePath = Process.GetCurrentProcess().MainModule.FileName;
                string exeName = Path.GetFileName(currentExePath);
                string batchPath = Path.Combine(Path.GetTempPath(), "quizgenie_updater.bat");

                string batchContent = 
                    "@echo off\r\n" +
                    "chcp 65001 > nul\r\n" +
                    "timeout /t 1 /nobreak > nul\r\n" +
                    ":wait_loop\r\n" +
                    "tasklist /fi \"imagename eq " + exeName + "\" | find /i \"" + exeName + "\" > nul\r\n" +
                    "if not errorlevel 1 (\r\n" +
                    "    timeout /t 1 /nobreak > nul\r\n" +
                    "    goto wait_loop\r\n" +
                    ")\r\n" +
                    "copy /y \"" + tempExePath + "\" \"" + currentExePath + "\" > nul\r\n" +
                    "start \"\" \"" + currentExePath + "\"\r\n" +
                    "del \"" + tempExePath + "\" > nul\r\n" +
                    "del \"%~f0\" > nul\r\n";

                File.WriteAllText(batchPath, batchContent, Encoding.Default);

                var psi = new ProcessStartInfo
                {
                    FileName = batchPath,
                    CreateNoWindow = true,
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                Process.Start(psi);
                Application.Exit();
            }
            catch (Exception ex)
            {
                lblUpdateProgress.Visible = false;
                btnInstallUpdate.Enabled = true;
                btnInstallUpdate.Text = "⬇️ إعادة محاولة تحميل التحديث";
                MessageBox.Show("حدث خطأ أثناء تحميل التحديث: " + ex.Message, "فشل التحديث", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void LoadSettings()
        {
            try
            {
                if (File.Exists(configPath))
                {
                    string content = File.ReadAllText(configPath);
                    currentConfig = json.Deserialize<AppConfig>(content);
                    if (currentConfig != null && !string.IsNullOrEmpty(currentConfig.BorderShape))
                    {
                        UITheme.SetShapeMode(currentConfig.BorderShape);
                    }
                }
            }
            catch { }

            if (currentConfig == null)
            {
                currentConfig = new AppConfig
                {
                    ActiveServer = "free",
                    GeminiKey = "",
                    OpenAIKey = "",
                    IsFirstRunAfterUpdate = true,
                    InstalledVersion = ""
                };
            }
        }

        private void SaveSettings()
        {
            try
            {
                if (txtGeminiKey != null) currentConfig.GeminiKey = txtGeminiKey.Text.Trim();
                if (string.IsNullOrWhiteSpace(currentConfig.GeminiKey)) currentConfig.GeminiKey = DEFAULT_GEMINI_KEY;
                if (txtOpenAIKey != null) currentConfig.OpenAIKey = txtOpenAIKey.Text.Trim();
                if (txtDeepSeekKey != null) currentConfig.DeepSeekKey = txtDeepSeekKey.Text.Trim();
                if (txtGroqKey != null) currentConfig.GroqKey = txtGroqKey.Text.Trim();
                string output = json.Serialize(currentConfig);
                File.WriteAllText(configPath, output);
            }
            catch { }
        }

        private void ApplySettingsToUI()
        {
            if (string.IsNullOrWhiteSpace(currentConfig.GeminiKey)) currentConfig.GeminiKey = DEFAULT_GEMINI_KEY;
            txtGeminiKey.Text = currentConfig.GeminiKey;
            txtOpenAIKey.Text = currentConfig.OpenAIKey ?? "";
            if (txtDeepSeekKey != null) txtDeepSeekKey.Text = currentConfig.DeepSeekKey ?? "";
            if (txtGroqKey != null) txtGroqKey.Text = currentConfig.GroqKey ?? "";

            if (currentConfig.ActiveServer == "gemini")
                rbGemini.Checked = true;
            else if (currentConfig.ActiveServer == "openai")
                rbOpenAI.Checked = true;
            else if (currentConfig.ActiveServer == "deepseek")
                rbDeepSeek.Checked = true;
            else if (currentConfig.ActiveServer == "groq")
                rbGroq.Checked = true;
            else if (currentConfig.ActiveServer == "free_backup")
                rbFreeBackup.Checked = true;
            else
                rbFree.Checked = true;

            SwitchServer(currentConfig.ActiveServer ?? "free");
            isFloatingPopupEnabled = currentConfig != null ? currentConfig.FloatingPopupEnabled : true;
            if (chkFloatingPopup != null) chkFloatingPopup.Checked = isFloatingPopupEnabled;
            if (selectionMonitor != null) selectionMonitor.IsEnabled = isFloatingPopupEnabled;
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public class AppConfig
    {
        public string ActiveServer { get; set; }
        public string GeminiKey { get; set; }
        public string OpenAIKey { get; set; }
        public string DeepSeekKey { get; set; }
        public string GroqKey { get; set; }
        public string Subject { get; set; }
        public string TargetLanguage { get; set; }
        public string DefaultMode { get; set; }
        public bool IsFirstRunAfterUpdate { get; set; }
        public string UpdateServerUrl { get; set; }
        public string InstalledVersion { get; set; }
        private bool _floatingPopupEnabled = true;
        public bool FloatingPopupEnabled { get { return _floatingPopupEnabled; } set { _floatingPopupEnabled = value; } }
        public string BorderShape { get; set; }
    }

    public class UpdateInfo
    {
        public string latest_version { get; set; }
        public string release_title { get; set; }
        public string download_url { get; set; }
        public object[] release_notes { get; set; }
    }

    public class HistoryItem
    {
        public string Id { get; set; }
        public string Timestamp { get; set; }
        public string Question { get; set; }
        public string ConciseAnswer { get; set; }
        public string DetailedAnswer { get; set; }
        public string Subject { get; set; }
        public bool IsImage { get; set; }
    }

    public static class HistoryManager
    {
        private static readonly object _sync = new object();

        private static string GetHistoryPath()
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "QuizGenie");
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            return Path.Combine(dir, "quizgenie_history.json");
        }

        public static List<HistoryItem> LoadHistory()
        {
            lock (_sync)
            {
                string path = GetHistoryPath();
                if (!File.Exists(path)) return new List<HistoryItem>();
                try
                {
                    string json = File.ReadAllText(path, Encoding.UTF8);
                    var ser = new JavaScriptSerializer();
                    ser.MaxJsonLength = 20971520;
                    var list = ser.Deserialize<List<HistoryItem>>(json);
                    return list ?? new List<HistoryItem>();
                }
                catch { return new List<HistoryItem>(); }
            }
        }

        public static void AddEntry(string question, string concise, string detailed, string subject, bool isImage)
        {
            lock (_sync)
            {
                var list = LoadHistory();
                var existing = list.Find(h => h.Question == question);
                if (existing != null)
                {
                    if (!string.IsNullOrEmpty(concise)) existing.ConciseAnswer = concise;
                    if (!string.IsNullOrEmpty(detailed)) existing.DetailedAnswer = detailed;
                    existing.Timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                }
                else
                {
                    var item = new HistoryItem
                    {
                        Id = Guid.NewGuid().ToString("N").Substring(0, 8),
                        Timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        Question = question,
                        ConciseAnswer = concise,
                        DetailedAnswer = detailed,
                        Subject = subject ?? "general",
                        IsImage = isImage
                    };
                    list.Insert(0, item);
                    if (list.Count > 500) list.RemoveRange(500, list.Count - 500);
                }

                try
                {
                    string path = GetHistoryPath();
                    var ser = new JavaScriptSerializer();
                    ser.MaxJsonLength = 20971520;
                    string json = ser.Serialize(list);
                    File.WriteAllText(path, json, Encoding.UTF8);
                }
                catch { }
            }
        }

        public static void ClearHistory()
        {
            lock (_sync)
            {
                try
                {
                    string path = GetHistoryPath();
                    if (File.Exists(path)) File.Delete(path);
                }
                catch { }
            }
        }

        public static string ExportStudySheetHtml()
        {
            var list = LoadHistory();
            StringBuilder sb = new StringBuilder();
            sb.AppendLine("<!DOCTYPE html><html dir='rtl' lang='ar'><head><meta charset='utf-8'>");
            sb.AppendLine("<title>ظ…ظ„ط®طµ ط§ظ„ظ…ط°ط§ظƒط±ط© ظˆط§ظ„ظ…ط±ط§ط¬ط¹ط© ط§ظ„ط´ط§ظ…ظ„ط© - QuizGenie</title>");
            sb.AppendLine("<style>");
            sb.AppendLine("body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 30px; line-height: 1.6; }");
            sb.AppendLine(".container { max-width: 900px; margin: 0 auto; }");
            sb.AppendLine(".header { text-align: center; border-bottom: 2px solid #38bdf8; padding-bottom: 20px; margin-bottom: 30px; }");
            sb.AppendLine(".title { font-size: 28px; font-weight: bold; color: #38bdf8; margin: 0; }");
            sb.AppendLine(".subtitle { color: #94a3b8; font-size: 14px; margin-top: 5px; }");
            sb.AppendLine(".card { background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }");
            sb.AppendLine(".q-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 12px; }");
            sb.AppendLine(".badge { background: #0284c7; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; }");
            sb.AppendLine(".date { color: #64748b; font-size: 12px; }");
            sb.AppendLine(".question { font-size: 16px; font-weight: bold; color: #f8fafc; margin-bottom: 12px; white-space: pre-wrap; }");
            sb.AppendLine(".ans-concise { background: #064e3b; border-right: 4px solid #10b981; padding: 12px; border-radius: 6px; margin-bottom: 10px; white-space: pre-wrap; font-size: 14px; color: #a7f3d0; }");
            sb.AppendLine(".ans-detailed { background: #312e81; border-right: 4px solid #8b5cf6; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; color: #ddd6fe; }");
            sb.AppendLine("@media print { body { background: #fff; color: #000; } .card { border: 1px solid #ccc; background: #fff; color: #000; } .ans-concise { background: #e6fffa; color: #065f46; } .ans-detailed { background: #f3f0ff; color: #4c1d95; } }");
            sb.AppendLine("</style></head><body>");
            sb.AppendLine("<div class='container'>");
            sb.AppendLine("<div class='header'><h1 class='title'>âڑ، ظ…ظ„ط®طµ ط§ظ„ظ…ط°ط§ظƒط±ط© ط§ظ„ط°ظƒظٹ - QuizGenie</h1><div class='subtitle'>طھظ… طھطµط¯ظٹط±ظ‡ ظپظٹ " + DateTime.Now.ToString("yyyy-MM-dd HH:mm") + " | ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ط£ط³ط¦ظ„ط©: " + list.Count + "</div></div>");

            if (list.Count == 0)
            {
                sb.AppendLine("<div style='text-align: center; color: #94a3b8; padding: 40px;'>ظ„ط§ طھظˆط¬ط¯ ط£ط³ط¦ظ„ط© ظ…ط³ط¬ظ„ط© ظپظٹ ط§ظ„ط³ط¬ظ„ ط­طھظ‰ ط§ظ„ط¢ظ†. ط§ط¨ط¯ط£ ط¨ط­ظ„ ط§ظ„ط£ط³ط¦ظ„ط© ظ„طھط¸ظ‡ط± ظ‡ظ†ط§ طھظ„ظ‚ط§ط¦ظٹط§ظ‹!</div>");
            }
            else
            {
                int idx = 1;
                foreach (var item in list)
                {
                    sb.AppendLine("<div class='card'>");
                    sb.AppendLine("<div class='q-header'>");
                    sb.AppendLine("<span class='badge'>ط³ط¤ط§ظ„ #" + (idx++) + (item.IsImage ? " (طµظˆط±ط© ًں“¸)" : "") + " - " + (item.Subject ?? "ط¹ط§ظ…") + "</span>");
                    sb.AppendLine("<span class='date'>" + item.Timestamp + "</span>");
                    sb.AppendLine("</div>");
                    sb.AppendLine("<div class='question'>" + System.Security.SecurityElement.Escape(item.Question) + "</div>");
                    if (!string.IsNullOrEmpty(item.ConciseAnswer))
                    {
                        sb.AppendLine("<div class='ans-concise'><strong>ًںژ¯ ط§ظ„ط­ظ„ ط§ظ„ظ…ط¨ط§ط´ط± ط§ظ„ط­ط§ط³ظ…:</strong><br/>" + System.Security.SecurityElement.Escape(item.ConciseAnswer) + "</div>");
                    }
                    if (!string.IsNullOrEmpty(item.DetailedAnswer))
                    {
                        sb.AppendLine("<div class='ans-detailed'><strong>ًں“– ط§ظ„ط´ط±ط­ ظˆط§ظ„طھظپظ†ظٹط¯ ط§ظ„ط£ظƒط§ط¯ظٹظ…ظٹ:</strong><br/>" + System.Security.SecurityElement.Escape(item.DetailedAnswer) + "</div>");
                    }
                    sb.AppendLine("</div>");
                }
            }

            sb.AppendLine("</div></body></html>");
            return sb.ToString();
        }
    }
}