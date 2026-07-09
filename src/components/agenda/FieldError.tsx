type FieldErrorProps = {
  id: string;
  message?: string;
};

export default function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}
