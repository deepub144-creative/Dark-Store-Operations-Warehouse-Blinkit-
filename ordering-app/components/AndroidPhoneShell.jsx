"use client";

export default function AndroidPhoneShell({
  children,
  appName = "AUDIT'X",
  statusBarBg = "#0b0f19",
  statusBarColor = "#e2e8f0",
  homeRoute = "/",
  navBg = "#080c14",
}) {
  return (
    <div style={styles.outerContainer}>
      <div style={styles.phoneFrame}>
        <div style={styles.screenBody}>
          {children}
        </div>
      </div>
    </div>
  );
}

const styles = {
  outerContainer: {
    minHeight: "100vh",
    width: "100%",
    background: "#050811",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
  },
  phoneFrame: {
    width: "100%",
    maxWidth: 480,
    minHeight: "100vh",
    background: "#090d16",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    boxShadow: "0 0 50px rgba(0, 0, 0, 0.7), 0 20px 40px rgba(0,0,0,0.5)",
    overflowX: "hidden",
    borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
    borderRight: "1px solid rgba(255, 255, 255, 0.08)",
  },
  screenBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
};
