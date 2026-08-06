import Combine
import Foundation
import WidgetKit

@MainActor
final class AuthViewModel: ObservableObject {
    enum State {
        case checking
        case signedOut
        case signedIn(email: String)
    }

    @Published private(set) var state: State = .checking
    @Published private(set) var isSigningIn = false
    @Published private(set) var isRefreshing = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var sessionMessage: String?

    private let service = AuthService()

    init() {
        Task {
            await restoreSession()
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
            sessionMessage = "Session verified."
            WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func refreshSessionAndWidget() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        errorMessage = nil
        defer { isRefreshing = false }

        do {
            guard let stored = try SessionStore.loadStored() else {
                state = .signedOut
                sessionMessage = nil
                return
            }

            let usable = try await usableSession(from: stored)
            state = .signedIn(email: usable.session.user.email ?? "your account")
            sessionMessage = "Session verified. Widget refresh requested."
            WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
        } catch AuthServiceError.unauthorized {
            expireSession()
        } catch {
            sessionMessage = "The saved login exists, but it could not be verified right now."
            errorMessage = error.localizedDescription
            WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
        }
    }

    func signOut() {
        do {
            try SessionStore.clear()
            UserDefaults(suiteName: "group.kirill-katz.timer-app")?
                .removeObject(forKey: "widget-focus-summary")
            errorMessage = nil
            sessionMessage = nil
            state = .signedOut
            WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func restoreSession() async {
        do {
            guard let stored = try SessionStore.loadStored() else {
                state = .signedOut
                return
            }

            do {
                let usable = try await usableSession(from: stored)
                state = .signedIn(email: usable.session.user.email ?? "your account")
                sessionMessage = "Session verified."
                WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
            } catch AuthServiceError.unauthorized {
                expireSession()
            } catch {
                // A network outage must not destroy a potentially valid refresh token.
                state = .signedIn(email: stored.session.user.email ?? "your account")
                sessionMessage = "The saved login exists, but it could not be verified right now."
                errorMessage = error.localizedDescription
            }
        } catch {
            state = .signedOut
            errorMessage = "The saved session could not be read. Please sign in again."
        }
    }

    private func usableSession(
        from stored: StoredSupabaseSession
    ) async throws -> StoredSupabaseSession {
        if stored.isExpired {
            return try await refreshIfStillCurrent(stored)
        }

        do {
            try await service.validate(stored)
            return stored
        } catch AuthServiceError.unauthorized {
            return try await refreshIfStillCurrent(stored)
        }
    }

    private func refreshIfStillCurrent(
        _ stored: StoredSupabaseSession
    ) async throws -> StoredSupabaseSession {
        // The widget may have rotated the refresh token while the app was checking it.
        // Never overwrite a newer Keychain session with the result of a stale refresh.
        if let latest = try SessionStore.loadStored(),
           latest.session.accessToken != stored.session.accessToken {
            return try await usableSession(from: latest)
        }

        let refreshed = try await service.refresh(stored)

        if let latest = try SessionStore.loadStored(),
           latest.session.accessToken != stored.session.accessToken {
            return try await usableSession(from: latest)
        }

        try SessionStore.save(refreshed)
        guard let updated = try SessionStore.loadStored() else {
            throw AuthServiceError.invalidResponse
        }
        return updated
    }

    private func expireSession() {
        try? SessionStore.clear()
        UserDefaults(suiteName: "group.kirill-katz.timer-app")?
            .removeObject(forKey: "widget-focus-summary")
        state = .signedOut
        sessionMessage = nil
        errorMessage = "Your session expired. Please sign in again."
        WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
    }
}
