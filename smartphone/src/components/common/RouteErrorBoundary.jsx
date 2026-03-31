import React from "react";

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: String(error?.message || "Erreur inconnue"),
    };
  }

  componentDidCatch(error) {
    // Keep a visible trace in dev tools for faster root-cause fix.
    // eslint-disable-next-line no-console
    console.error("RouteErrorBoundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4">
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(254,242,242,0.8)", border: "1px solid rgba(220,38,38,0.25)" }}
          >
            <p className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: "#991b1b" }}>
              Erreur d'affichage chantier
            </p>
            <p className="text-[11px] mt-1" style={{ color: "#7f1d1d" }}>
              {this.state.errorMessage}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

