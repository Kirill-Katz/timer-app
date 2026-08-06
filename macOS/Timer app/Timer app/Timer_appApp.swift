//
//  Timer_appApp.swift
//  Timer app
//
//  Created by Chiril Cat on 02.08.2026.
//

import AppKit
import SwiftUI

@main
struct Timer_appApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { _ in
                    NSApplication.shared.activate(ignoringOtherApps: true)
                    NSApplication.shared.windows
                        .first(where: \.canBecomeKey)?
                        .makeKeyAndOrderFront(nil)
                }
        }
    }
}
