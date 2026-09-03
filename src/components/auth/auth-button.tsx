"use client";

import { authClient } from "~/lib/auth-client";
import { siDiscord } from "simple-icons/icons";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut } from "lucide-react";

interface AuthButtonProps {
  isAuthenticated: boolean;
  userImage: string | null | undefined;
}

export function AuthButton({ isAuthenticated, userImage }: AuthButtonProps) {
  const router = useRouter();

  return isAuthenticated ? (
    <div className="flex cursor-pointer items-center gap-2 rounded-lg bg-gray-100 p-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
      {userImage && (
        <Image
          src={userImage}
          alt="User avatar"
          width={32}
          height={32}
          className="rounded-full"
        />
      )}
      <button
        onClick={() => {
          router.push("/");
          authClient.signOut();
        }}
        className="flex w-full cursor-pointer items-center justify-center p-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
      >
        <div className="flex items-center justify-center gap-3">
          Sign out
          <LogOut className="h-5 w-5" />
        </div>
      </button>
    </div>
  ) : (
    <button
      onClick={() => authClient.signIn.social({ provider: "discord" })}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-100 p-3 text-sm text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d={siDiscord.path} />
      </svg>
      Sign in
    </button>
  );
}
