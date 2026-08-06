import AppIntents
import SwiftUI
import WidgetKit

struct FocusEntry: TimelineEntry {
    let date: Date
    let summary: FocusSummary?
    let message: String?
    let isStale: Bool
}

struct FocusProvider: TimelineProvider {
    func placeholder(in context: Context) -> FocusEntry {
        FocusEntry(date: Date(), summary: .preview, message: nil, isStale: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (FocusEntry) -> Void) {
        if context.isPreview {
            completion(FocusEntry(date: Date(), summary: .preview, message: nil, isStale: false))
            return
        }

        completion(
            FocusEntry(
                date: Date(),
                summary: FocusSummaryCache.load(),
                message: nil,
                isStale: false
            )
        )
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FocusEntry>) -> Void) {
        Task {
            let entry: FocusEntry

            do {
                let summary = try await FocusDataService().fetchToday()
                FocusSummaryCache.save(summary)
                entry = FocusEntry(
                    date: Date(),
                    summary: summary,
                    message: nil,
                    isStale: false
                )
            } catch {
                entry = FocusEntry(
                    date: Date(),
                    summary: FocusSummaryCache.load(),
                    message: (error as? LocalizedError)?.errorDescription
                        ?? error.localizedDescription,
                    isStale: true
                )
            }

            let nextRefresh = Calendar.current.date(
                byAdding: .minute,
                value: 15,
                to: Date()
            ) ?? Date().addingTimeInterval(15 * 60)
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }
}

struct TimerWidgetEntryView: View {
    let entry: FocusEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if let summary = entry.summary {
                summaryView(summary)
            } else {
                unavailableView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "timer-app://today"))
        .containerBackground(.background, for: .widget)
    }

    private func summaryView(_ summary: FocusSummary) -> some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 6 : 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("Today")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                Spacer()

                if entry.isStale {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                        .help(entry.message ?? "Showing the last update")
                }

                Text(summary.fetchedAt, style: .time)
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.tertiary)

                refreshButton
            }

            Text(formatTotal(summary.totalSeconds))
                .font(.system(size: family == .systemSmall ? 34 : 40, weight: .bold, design: .rounded))
                .contentTransition(.numericText())
                .minimumScaleFactor(0.75)
                .lineLimit(1)

            if summary.projects.isEmpty {
                Spacer()
                Text("No focus time yet")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 5) {
                    ForEach(summary.projects.prefix(maxProjectRows)) { project in
                        projectRow(project)
                    }
                }
            }

            Spacer(minLength: 0)
        }
    }

    private func projectRow(_ project: ProjectFocus) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Color(hex: project.color))
                .frame(width: 7, height: 7)

            Text(project.name)
                .font(.caption)
                .lineLimit(1)

            Spacer(minLength: 4)

            Text(formatProject(project.seconds))
                .font(.caption.monospacedDigit().weight(.medium))
                .foregroundStyle(.secondary)
        }
    }

    private var unavailableView: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "timer")
                    .font(.title2)
                    .foregroundStyle(.tint)

                Spacer()

                refreshButton
            }

            Spacer()

            Text("Focus time unavailable")
                .font(.headline)

            Text(entry.message ?? "Open Timer and sign in.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
    }

    private var refreshButton: some View {
        Button(intent: RefreshFocusIntent()) {
            Image(systemName: "arrow.clockwise")
                .font(.caption.weight(.semibold))
        }
        .buttonStyle(.plain)
        .help("Refresh focus time")
    }

    private var maxProjectRows: Int {
        family == .systemSmall ? 3 : 5
    }

    private func formatTotal(_ seconds: TimeInterval) -> String {
        let totalMinutes = max(0, Int(seconds) / 60)
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60

        if hours == 0 { return "\(minutes)m" }
        if minutes == 0 { return "\(hours)h" }
        return "\(hours)h \(minutes)m"
    }

    private func formatProject(_ seconds: TimeInterval) -> String {
        let totalMinutes = max(0, Int(seconds) / 60)
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60
        return hours > 0 ? "\(hours)h \(minutes)m" : "\(minutes)m"
    }
}

struct Timer_Widget: Widget {
    let kind = "Timer_Widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FocusProvider()) { entry in
            TimerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today's Focus")
        .description("Today's total focus time and project breakdown.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private extension Color {
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)

        let red: Double
        let green: Double
        let blue: Double

        if sanitized.count == 6 {
            red = Double((value >> 16) & 0xFF) / 255
            green = Double((value >> 8) & 0xFF) / 255
            blue = Double(value & 0xFF) / 255
        } else {
            red = 0.47
            green = 0.44
            blue = 0.42
        }

        self.init(red: red, green: green, blue: blue)
    }
}
