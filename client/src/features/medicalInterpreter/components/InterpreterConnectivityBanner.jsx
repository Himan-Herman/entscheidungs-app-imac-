/**
 * @param {{
 *   variant: 'offline' | 'reconnected';
 *   message: string;
 * }} props
 */
export default function InterpreterConnectivityBanner({ variant, message }) {
  const className =
    variant === "offline"
      ? "interpreter-connectivity interpreter-connectivity--offline"
      : "interpreter-connectivity interpreter-connectivity--reconnected";

  return (
    <p className={className} role="status" aria-live="polite">
      {message}
    </p>
  );
}
