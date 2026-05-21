import InterpreterPracticeDashboardShell from "../components/InterpreterPracticeDashboardShell.jsx";
import InterpreterPracticeFeatureGate from "../components/InterpreterPracticeFeatureGate.jsx";
import "../styles/MedicalInterpreter.css";

export default function InterpreterPracticeDashboardPage() {
  return (
    <InterpreterPracticeFeatureGate>
      <InterpreterPracticeDashboardShell />
    </InterpreterPracticeFeatureGate>
  );
}
