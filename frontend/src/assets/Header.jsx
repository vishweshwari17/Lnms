import { useEffect, useState } from "react";

function formatNow(date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function Header() {
  const [now, setNow] = useState(() => formatNow(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(formatNow(new Date()));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-blue-800 text-white px-8 py-4 flex justify-between items-center border-b border-blue-900">

      <div className="text-lg font-semibold tracking-wide">
        TCS Local Network Management System
      </div>

      <div className="text-sm">
        USER: <span className="font-semibold">Admin</span> |
        NODE ID: 121 |
        <span className="font-semibold ml-1">{now}</span>
      </div>

    </header>
  );
}

export default Header;
