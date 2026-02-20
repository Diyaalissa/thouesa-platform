import EmailOtpForm from "../EmailOtpForm";

export default function RegisterPage() {
  return (
    <div className="grid place-items-center" style={{ minHeight: "70vh" }}>
      <EmailOtpForm mode="register" />
    </div>
  );
}
