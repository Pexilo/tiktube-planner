// Icône de barre des menus : démarre / arrête la plateforme Studio YouTube et affiche son état.
// Compilée et installée par scripts/install-menubar.sh.
import Cocoa

let ROOT = "__ROOT__"
let NODE = "__NODE__"
let URL_DASH = "http://localhost:4321"

final class AppDelegate: NSObject, NSApplicationDelegate {
    var item: NSStatusItem!
    var proc: Process?
    var timer: Timer?
    let statusLine = NSMenuItem(title: "…", action: nil, keyEquivalent: "")
    let statsLine = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    let nextLine = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    var toggleItem: NSMenuItem!
    var autoItem: NSMenuItem!
    var reachable = false
    var autopilot = false

    func applicationDidFinishLaunching(_ n: Notification) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        let menu = NSMenu()
        menu.autoenablesItems = false
        for l in [statusLine, statsLine, nextLine] { l.isEnabled = false; menu.addItem(l) }
        menu.addItem(.separator())
        menu.addItem(withTitle: "Ouvrir le dashboard", action: #selector(openDash), keyEquivalent: "d").target = self
        toggleItem = menu.addItem(withTitle: "Arrêter la plateforme", action: #selector(toggle), keyEquivalent: "s")
        toggleItem.target = self
        autoItem = menu.addItem(withTitle: "Autopilote (envois automatiques)", action: #selector(toggleAuto), keyEquivalent: "a")
        autoItem.target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Ouvrir le dossier du projet", action: #selector(openFolder), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Voir le journal", action: #selector(openLog), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quitter Studio YouTube", action: #selector(quit), keyEquivalent: "q").target = self
        item.menu = menu
        refreshUI()
        start()
        timer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in self?.poll() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { self.poll() }
    }

    var ownsServer: Bool { proc?.isRunning == true }

    func start() {
        if ownsServer { return }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: NODE)
        p.arguments = ["\(ROOT)/server/index.mjs"]
        p.currentDirectoryURL = URL(fileURLWithPath: ROOT)
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "\((NODE as NSString).deletingLastPathComponent):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        env["NO_OPEN"] = "1"
        p.environment = env
        let logPath = "\(ROOT)/data/server.log"
        if !FileManager.default.fileExists(atPath: logPath) { FileManager.default.createFile(atPath: logPath, contents: nil) }
        if let h = FileHandle(forWritingAtPath: logPath) { h.seekToEndOfFile(); p.standardOutput = h; p.standardError = h }
        p.terminationHandler = { [weak self] _ in DispatchQueue.main.async { self?.poll() } }
        do { try p.run(); proc = p } catch { statusLine.title = "⚠️ Impossible de lancer node" }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { self.poll() }
    }

    func stop() {
        guard let p = proc, p.isRunning else { return }
        p.terminate()
        proc = nil
        // Rendu en cours : on laisse 2 s puis on force.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { if p.isRunning { kill(p.processIdentifier, SIGKILL) }; self.poll() }
    }

    func poll() {
        guard let url = URL(string: "\(URL_DASH)/api/state") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 4
        URLSession.shared.dataTask(with: req) { data, _, _ in
            var stats: [String: Any]? = nil
            if let d = data, let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] { stats = j }
            DispatchQueue.main.async { self.apply(stats) }
        }.resume()
    }

    func apply(_ s: [String: Any]?) {
        reachable = s != nil
        if let s = s, let videos = s["videos"] as? [[String: Any]] {
            let total = videos.count
            let rendered = videos.filter { ($0["rendered"] as? Bool) == true }.count
            let uploaded = videos.filter { $0["youtubeId"] is String }.count
            statsLine.title = "📤 \(uploaded)/\(total) programmées · 🎬 \(rendered)/\(total) rendues"
            let now = ISO8601DateFormatter().string(from: Date())
            let next = videos.compactMap { v -> (String, String)? in
                guard let p = v["publishAt"] as? String, p > now, v["youtubeId"] is String else { return nil }
                return (p, v["appName"] as? String ?? "")
            }.sorted { $0.0 < $1.0 }.first
            if let n = next, let d = ISO8601DateFormatter.withFractional.date(from: n.0) {
                let f = DateFormatter(); f.locale = Locale(identifier: "fr_BE"); f.dateFormat = "EEE d MMM HH:mm"
                nextLine.title = "⏭ Prochaine sortie : \(f.string(from: d)) · \(n.1)"
            } else { nextLine.title = "" }
            if let settings = s["settings"] as? [String: Any] { autopilot = (settings["autopilot"] as? Bool) ?? false }
            if let r = s["render"] as? [String: Any], let c = r["current"] as? [String: Any], let id = c["id"] as? String {
                let pct = Int(((c["progress"] as? Double) ?? 0) * 100)
                statusLine.title = "🟢 En marche — rendu \(id) \(pct) %"
            } else if let u = s["upload"] as? [String: Any], let id = u["id"] as? String {
                statusLine.title = "🟢 En marche — envoi \(id)"
            } else {
                statusLine.title = ownsServer ? "🟢 En marche" : "🟢 En marche (lancée ailleurs)"
            }
        } else {
            statusLine.title = "⚪️ Arrêtée"
            statsLine.title = ""
            nextLine.title = ""
        }
        refreshUI()
    }

    func refreshUI() {
        let name = reachable ? "play.rectangle.fill" : "play.rectangle"
        let img = NSImage(systemSymbolName: name, accessibilityDescription: "Studio YouTube")
        img?.isTemplate = true
        item.button?.image = img
        item.button?.toolTip = reachable ? "Studio YouTube — en marche" : "Studio YouTube — arrêtée"
        toggleItem?.title = reachable ? "Arrêter la plateforme" : "Démarrer la plateforme"
        toggleItem?.isEnabled = !reachable || ownsServer
        autoItem?.state = autopilot ? .on : .off
        autoItem?.isEnabled = reachable
        nextLine.isHidden = nextLine.title.isEmpty
        statsLine.isHidden = statsLine.title.isEmpty
    }

    @objc func toggle() { if reachable { stop() } else { start() } }
    @objc func openDash() { if !reachable { start() }; NSWorkspace.shared.open(URL(string: URL_DASH)!) }
    @objc func openFolder() { NSWorkspace.shared.open(URL(fileURLWithPath: ROOT)) }
    @objc func openLog() { NSWorkspace.shared.open(URL(fileURLWithPath: "\(ROOT)/data/server.log")) }
    @objc func toggleAuto() {
        var req = URLRequest(url: URL(string: "\(URL_DASH)/api/settings")!)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["autopilot": !autopilot])
        URLSession.shared.dataTask(with: req) { _, _, _ in DispatchQueue.main.async { self.poll() } }.resume()
    }
    @objc func quit() { stop(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { NSApp.terminate(nil) } }
    func applicationWillTerminate(_ n: Notification) { proc?.terminate() }
}

extension ISO8601DateFormatter {
    static let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
