import Foundation

struct FocusDataService {
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 15
        return URLSession(configuration: configuration)
    }()

    func fetchToday() async throws -> FocusSummary {
        var context = try await WidgetAuthManager.shared.context()

        do {
            return try await fetchSummary(using: context)
        } catch let error as FocusDataError where error.isUnauthorized {
            context = try await WidgetAuthManager.shared.context(
                rejectedAccessToken: context.session.accessToken
            )
            return try await fetchSummary(using: context)
        }
    }

    private func fetchSummary(using context: WidgetStoredSession) async throws -> FocusSummary {
        guard let baseURL = URL(string: context.projectURL) else {
            throw FocusDataError.invalidConfiguration
        }

        let now = Date()
        let calendar = Calendar.autoupdatingCurrent
        let dayStart = calendar.startOfDay(for: now)
        guard let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) else {
            throw FocusDataError.invalidConfiguration
        }

        async let logs = fetchLogs(
            baseURL: baseURL,
            context: context,
            dayStart: dayStart,
            dayEnd: dayEnd
        )
        async let projects = fetchProjects(baseURL: baseURL, context: context)

        return aggregate(
            logs: try await logs,
            projects: try await projects,
            dayStart: dayStart,
            dayEnd: dayEnd,
            now: now
        )
    }

    private func fetchLogs(
        baseURL: URL,
        context: WidgetStoredSession,
        dayStart: Date,
        dayEnd: Date
    ) async throws -> [TimeLogRow] {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("rest/v1/time_logs"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "project_id,start_time,end_time"),
            URLQueryItem(name: "user_id", value: "eq.\(context.session.user.id)"),
            URLQueryItem(name: "deleted_at", value: "is.null"),
            URLQueryItem(name: "start_time", value: "lt.\(Self.isoString(dayEnd))"),
            URLQueryItem(
                name: "or",
                value: "(end_time.is.null,end_time.gt.\(Self.isoString(dayStart)))"
            ),
            URLQueryItem(name: "order", value: "start_time.asc")
        ]

        guard let url = components?.url else {
            throw FocusDataError.invalidConfiguration
        }
        return try await request(url: url, context: context)
    }

    private func fetchProjects(
        baseURL: URL,
        context: WidgetStoredSession
    ) async throws -> [ProjectRow] {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("rest/v1/projects"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "select", value: "id,name,color"),
            URLQueryItem(name: "user_id", value: "eq.\(context.session.user.id)")
        ]

        guard let url = components?.url else {
            throw FocusDataError.invalidConfiguration
        }
        return try await request(url: url, context: context)
    }

    private func request<Response: Decodable>(
        url: URL,
        context: WidgetStoredSession
    ) async throws -> Response {
        var request = URLRequest(url: url, timeoutInterval: 10)
        request.setValue(context.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue(
            "Bearer \(context.session.accessToken)",
            forHTTPHeaderField: "Authorization"
        )

        let (data, response) = try await Self.session.data(for: request)
        guard let response = response as? HTTPURLResponse else {
            throw FocusDataError.invalidResponse
        }
        guard (200..<300).contains(response.statusCode) else {
            throw FocusDataError.requestFailed(response.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard let decoded = try? decoder.decode(Response.self, from: data) else {
            throw FocusDataError.invalidResponse
        }
        return decoded
    }

    private func aggregate(
        logs: [TimeLogRow],
        projects: [ProjectRow],
        dayStart: Date,
        dayEnd: Date,
        now: Date
    ) -> FocusSummary {
        var projectByID: [String: ProjectRow] = [:]
        projects.forEach { projectByID[$0.id] = $0 }

        var secondsByProject: [String: TimeInterval] = [:]
        for log in logs {
            guard let start = Self.parseDate(log.startTime) else { continue }
            let rawEnd = log.endTime.flatMap(Self.parseDate) ?? now
            let clippedStart = max(start, dayStart)
            let clippedEnd = min(rawEnd, dayEnd, now)
            let duration = clippedEnd.timeIntervalSince(clippedStart)
            guard duration.isFinite, duration > 0 else { continue }
            secondsByProject[log.projectId, default: 0] += duration
        }

        let projectFocus: [ProjectFocus] = secondsByProject.compactMap { entry in
            let (projectID, seconds) = entry
            guard let project = projectByID[projectID] else { return nil }
            return ProjectFocus(
                id: projectID,
                name: project.name,
                color: project.color,
                seconds: seconds
            )
        }
        .sorted { left, right in
            if left.seconds == right.seconds { return left.name < right.name }
            return left.seconds > right.seconds
        }

        return FocusSummary(
            totalSeconds: projectFocus.reduce(0) { $0 + $1.seconds },
            projects: projectFocus,
            fetchedAt: now
        )
    }

    private static func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private static func parseDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }

        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: value)
    }
}
