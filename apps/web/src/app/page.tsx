import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 text-center">
      <div>
        <Image
          className="dark:invert mx-auto"
          src="/next.svg"
          alt="Analytix"
          width={100}
          height={20}
          priority
        />
      </div>
      <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-text-heading">
        Welcome to Analytix
      </h1>
      <p className="max-w-md text-lg leading-8 text-text-secondary">
        Financial intelligence platform. Use the sidebar to navigate to the dashboard.
      </p>
    </div>
  );
}
