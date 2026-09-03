"use client";

import { authClient } from "~/lib/auth-client";
import { siDiscord } from "simple-icons/icons";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignInModal = ({ isOpen, onClose }: SignInModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
          Sign in required
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Please sign in to continue your conversation.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="cursor-pointer rounded px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => authClient.signIn.social({ provider: "discord" })}
            className="flex cursor-pointer items-center gap-2 rounded bg-[#5865F2] px-4 py-2 text-white hover:bg-[#4752C4] focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d={siDiscord.path} />
            </svg>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
