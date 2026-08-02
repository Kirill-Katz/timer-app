import Foundation

enum SupabaseConfiguration {
    private struct Values: Decodable {
        let SupabaseURL: String
        let SupabasePublishableKey: String
    }

    private static let values: Values? = {
        guard let url = Bundle.main.url(
            forResource: "SupabaseConfig",
            withExtension: "plist"
        ), let data = try? Data(contentsOf: url) else {
            return nil
        }

        return try? PropertyListDecoder().decode(Values.self, from: data)
    }()

    static var projectURL: URL? {
        guard let value = values?.SupabaseURL, !value.isEmpty else { return nil }
        return URL(string: value)
    }

    static var publishableKey: String {
        values?.SupabasePublishableKey ?? ""
    }

    static var isConfigured: Bool {
        projectURL != nil && !publishableKey.isEmpty
    }
}
