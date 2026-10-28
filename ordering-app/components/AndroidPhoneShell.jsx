"use client";

export default function AndroidPhoneShell({
  children,
  appName = "AUDIT'X",
  statusBarBg = "#FFFDF2",
  statusBarColor = "#0F172A",
  homeRoute = "/",
  navBg = "#FFFFFF",
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
    background: "#080C14",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
    color: "#0F172A",
  },
  phoneFrame: {
    width: "100%",
    maxWidth: 440,
    minHeight: "100vh",
    background: "#F4F6FB",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    boxShadow: "0 0 40px rgba(0, 0, 0, 0.5)",
    overflowX: "hidden",
  },
  screenBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    background: "#F4F6FB",
  },
};

