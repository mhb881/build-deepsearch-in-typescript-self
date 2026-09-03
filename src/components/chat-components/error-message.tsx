import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage = ({ message }: ErrorMessageProps) => {
  return (
    <div className="mx-auto w-full max-w-[65ch]">
      <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        <AlertCircle className="size-5 shrink-0" />
        {message}
      </div>
    </div>
  );
};
