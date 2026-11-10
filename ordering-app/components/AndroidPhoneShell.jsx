"use client";

import IOSMobileShell from "@/components/ios/IOSMobileShell";

export default function AndroidPhoneShell({
  children,
  appName = "AUDIT'X",
  statusBarBg = "#FFFDF2",
  statusBarColor = "#0F172A",
  homeRoute = "/",
  navBg = "#FFFFFF",
  iosHeader = null,
  iosTabBar = null,
  iosOverlay = null,
  iosFooter = null,
  onRefresh = null,
  onSwipeBack = null,
}) {
  return (
    <IOSMobileShell
      header={iosHeader}
      tabBar={iosTabBar}
      stickyFooter={iosFooter}
      overlay={iosOverlay}
      onRefresh={onRefresh}
      onSwipeBack={onSwipeBack}
      style={{
        background: "var(--ios-bg)",
        color: "var(--ios-label)",
      }}
    >
      {children}
    </IOSMobileShell>
  );
}
