export function Footer() {
  return (
    <footer className="footer text-dark py-3">
      <div className="container-fluid">
        <div className="d-flex justify-content-center align-items-center text-center">
          <div className="text-sm">
            © {new Date().getFullYear()} Insular Cambios · Intranet corporativa
          </div>
        </div>
      </div>
    </footer>
  );
}
