import SwiftUI

struct ContentView: View {
    @StateObject private var auth = AuthViewModel()

    var body: some View {
        Group {
            switch auth.state {
            case .checking:
                ProgressView("Checking session…")
            case .signedOut:
                LoginView(auth: auth)
            case .signedIn(let email):
                SuccessView(
                    email: email,
                    isRefreshing: auth.isRefreshing,
                    sessionMessage: auth.sessionMessage,
                    errorMessage: auth.errorMessage,
                    refresh: {
                        Task { await auth.refreshSessionAndWidget() }
                    },
                    signOut: auth.signOut
                )
            }
        }
        .frame(minWidth: 420, minHeight: 420)
    }
}

private struct LoginView: View {
    @ObservedObject var auth: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?

    private enum Field {
        case email
        case password
    }

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                Image(systemName: "timer")
                    .font(.system(size: 42, weight: .medium))
                    .foregroundStyle(.tint)

                Text("Timer")
                    .font(.largeTitle.bold())

                Text("Sign in to connect your focus widget.")
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .focused($focusedField, equals: .email)
                    .onSubmit { focusedField = .password }

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .focused($focusedField, equals: .password)
                    .onSubmit(signIn)

                if let errorMessage = auth.errorMessage {
                    Text(errorMessage)
                        .font(.callout)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(action: signIn) {
                    Group {
                        if auth.isSigningIn {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Text("Sign In")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!canSignIn)
            }
            .textFieldStyle(.roundedBorder)
            .frame(maxWidth: 300)
        }
        .padding(40)
        .onAppear { focusedField = .email }
    }

    private var canSignIn: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !password.isEmpty
            && !auth.isSigningIn
    }

    private func signIn() {
        guard canSignIn else { return }
        Task {
            await auth.signIn(email: email, password: password)
        }
    }
}

private struct SuccessView: View {
    let email: String
    let isRefreshing: Bool
    let sessionMessage: String?
    let errorMessage: String?
    let refresh: () -> Void
    let signOut: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 58))
                .foregroundStyle(.green)

            VStack(spacing: 6) {
                Text("Signed In")
                    .font(.largeTitle.bold())
                Text("Signed in as \(email)")
                    .foregroundStyle(.secondary)
            }

            if let sessionMessage {
                Text(sessionMessage)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(errorMessage == nil ? Color.secondary : Color.orange)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button(action: refresh) {
                if isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text("Refresh Session & Widget")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRefreshing)

            Button("Sign Out", action: signOut)
                .buttonStyle(.bordered)
        }
        .padding(40)
    }
}
