import Foundation

struct SupabaseSession: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String
    let user: SupabaseUser
}

struct SupabaseUser: Codable {
    let id: String
    let email: String?
}

enum AuthServiceError: LocalizedError {
    case notConfigured
    case invalidResponse
    case serverMessage(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the repository's .env file, then rebuild the app."
        case .invalidResponse:
            "Supabase returned an unexpected response."
        case .serverMessage(let message):
            message
        }
    }
}

struct AuthService {
    func signIn(email: String, password: String) async throws -> SupabaseSession {
        guard SupabaseConfiguration.isConfigured,
              let projectURL = SupabaseConfiguration.projectURL,
              let endpoint = URL(
                string: "/auth/v1/token?grant_type=password",
                relativeTo: projectURL
              )?.absoluteURL else {
            throw AuthServiceError.notConfigured
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Credentials(email: email, password: password))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthServiceError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        guard (200..<300).contains(httpResponse.statusCode) else {
            let error = try? JSONDecoder().decode(SupabaseErrorResponse.self, from: data)
            throw AuthServiceError.serverMessage(
                error?.bestMessage ?? "Sign in failed (HTTP \(httpResponse.statusCode))."
            )
        }

        do {
            return try decoder.decode(SupabaseSession.self, from: data)
        } catch {
            throw AuthServiceError.invalidResponse
        }
    }
}

private struct Credentials: Encodable {
    let email: String
    let password: String
}

private struct SupabaseErrorResponse: Decodable {
    let message: String?
    let msg: String?
    let errorDescription: String?

    var bestMessage: String? {
        message ?? msg ?? errorDescription
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case msg
        case errorDescription = "error_description"
    }
}
