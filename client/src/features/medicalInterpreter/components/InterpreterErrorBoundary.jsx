import { Component } from "react";
import { Link } from "react-router-dom";

/**
 * Contains interpreter UI failures without breaking the patient shell.
 * Resets when `key` changes (route) so back navigation recovers the home screen.
 */
export default class InterpreterErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleBack = this.handleBack.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[MedicalInterpreter]", error?.name || "Error", error);
    }
  }

  handleBack() {
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      const t = this.props.labels ?? {};
      const reliability = t.reliability ?? {};
      const homePath = this.props.homePath || "/patient/interpreter";
      return (
        <main className="medical-interpreter-page interp-root" id="main-content">
          <div className="interpreter-feedback interpreter-feedback--error" role="alert">
            <p>{reliability.errorBoundaryBody}</p>
          </div>
          <Link
            className="medical-interpreter-page__back"
            to={homePath}
            replace
            onClick={this.handleBack}
          >
            {reliability.errorBoundaryBack}
          </Link>
        </main>
      );
    }
    return this.props.children;
  }
}
