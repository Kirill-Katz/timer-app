import Combine
import Foundation
import WidgetKit

@MainActor
final class AuthViewModel: ObservableObject {
    enum State {
        case signedOut
        case signedIn(email: String)
    }

    @Published private(set) var state: State = .signedOut
    @Published private(set) var isSigningIn = false
    @Published private(set) var errorMessage: String?

    private let service = AuthService()

    init() {
        if let session = try? SessionStore.load() {
            state = .signedIn(email: session.user.email ?? "your account")
        }
    }

    func signIn(email: String, password: String) async {
        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
            let session = try await service.signIn(email: normalizedEmail, password: password)
            try SessionStore.save(session)
            state = .signedIn(email: session.user.email ?? normalizedEmail)
            WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func signOut() {
        do {
            try SessionStore.clear()
            UserDefaults(suiteName: "group.kirill-katz.timer-app")?
                .removeObject(forKey: "widget-focus-summary")
            errorMessage = nil
            state = .signedOut
            WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
