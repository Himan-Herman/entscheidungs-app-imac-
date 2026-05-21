import { Component } from "react";
import { Link } from "react-router-dom";

/**
 * Contains interpreter UI failures without breaking the patient shell.
 */
export default class InterpreterErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[MedicalInterpreter]", error?.name || "Error");
    }
  }

  render() {
    if (this.state.hasError) {
      const t = this.props.labels ?? {};
      const reliability = t.reliability ?? {};
      return (
        <main className="medical-interpreter-page interp-root" id="main-content">
          <div className="interpreter-feedback interpreter-feedback--error" role="alert">
            <p>{reliability.errorBoundaryBody}</p>
          </div>
          <Link className="medical-interpreter-page__back" to="/patient/interpreter">
            {reliability.errorBoundaryBack}
          </Link>
        </main>
      );
    }
    return this.props.children;
  }
}
