import AppIntents
import WidgetKit

struct RefreshFocusIntent: AppIntent {
    static var title: LocalizedStringResource { "Refresh Focus" }
    static var description: IntentDescription {
        "Fetch today's focus time and update the Timer widget."
    }

    func perform() async throws -> some IntentResult {
        if let summary = try? await FocusDataService().fetchToday() {
            FocusSummaryCache.save(summary)
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "Timer_Widget")
        return .result()
    }
}
