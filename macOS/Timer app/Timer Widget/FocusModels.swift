import Foundation

struct FocusSummary: Codable {
    let totalSeconds: TimeInterval
    let projects: [ProjectFocus]
    let fetchedAt: Date

    static let preview = FocusSummary(
        totalSeconds: 2 * 3_600 + 18 * 60,
        projects: [
            ProjectFocus(id: "preview-1", name: "Programming", color: "#3B82F6", seconds: 5_220),
            ProjectFocus(id: "preview-2", name: "Reading", color: "#F59E0B", seconds: 2_340),
            ProjectFocus(id: "preview-3", name: "Planning", color: "#10B981", seconds: 600)
        ],
        fetchedAt: Date()
    )
}

struct ProjectFocus: Codable, Identifiable {
    let id: String
    let name: String
    let color: String
    let seconds: TimeInterval
}

enum FocusDataError: LocalizedError {
    case signedOut
    case sessionUnavailable
    case sessionCorrupted
    case invalidConfiguration
    case invalidResponse
    case requestFailed(Int)

    var isUnauthorized: Bool {
        if case .requestFailed(401) = self { return true }
        return false
    }

    var errorDescription: String? {
        switch self {
        case .signedOut:
            "Open Timer and sign in again."
        case .sessionUnavailable:
            "The saved session is temporarily unavailable."
        case .sessionCorrupted:
            "Open Timer to repair the saved session."
        case .invalidConfiguration:
            "Supabase configuration is unavailable."
        case .invalidResponse:
            "Supabase returned an unexpected response."
        case .requestFailed(let status):
            "Unable to refresh (HTTP \(status))."
        }
    }
}

struct TimeLogRow: Decodable {
    let projectId: String
    let startTime: String
    let endTime: String?
}

struct ProjectRow: Decodable {
    let id: String
    let name: String
    let color: String
}

enum FocusSummaryCache {
    private static let defaults = UserDefaults(suiteName: "group.kirill-katz.timer-app")
    private static let key = "widget-focus-summary"

    static func load() -> FocusSummary? {
        guard let data = defaults?.data(forKey: key) else { return nil }
        guard let summary = try? JSONDecoder().decode(FocusSummary.self, from: data) else {
            defaults?.removeObject(forKey: key)
            return nil
        }

        // Never show yesterday's total as if it belongs to today.
        guard Calendar.autoupdatingCurrent.isDateInToday(summary.fetchedAt) else {
            defaults?.removeObject(forKey: key)
            return nil
        }
        return summary
    }

    static func save(_ summary: FocusSummary) {
        guard let data = try? JSONEncoder().encode(summary) else { return }
        defaults?.set(data, forKey: key)
    }
}
