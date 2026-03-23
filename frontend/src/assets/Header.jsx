function Header() {
  return (
    <header className="bg-blue-800 text-white px-8 py-4 flex justify-between items-center border-b border-blue-900">

      <div className="text-lg font-semibold tracking-wide">
        TCS Local Network Management System
      </div>

      <div className="text-sm">
        USER: <span className="font-semibold">Admin</span> |
        NODE ID: 121 |
        27/02/2026
      </div>

    </header>
  );
}

export default Header;