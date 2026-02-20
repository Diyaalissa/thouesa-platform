import EmailOtpForm from "../EmailOtpForm";

export default function LoginPage() {
  return (
    <div className="grid place-items-center" style={{ minHeight: "70vh" }}>
      <EmailOtpForm mode="login" />
    </div>
  );
}
