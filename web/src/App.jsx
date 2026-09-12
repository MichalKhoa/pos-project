import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Receipt, Download, Settings, PackageOpen } from 'lucide-react';
import OverviewPage from './pages/OverviewPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ZReportsPage from './pages/ZReportsPage';
import IntakePage from './pages/IntakePage';
import TaxExportsPage from './pages/TaxExportsPage';
import CatalogPage from './pages/CatalogPage';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{ width: '250px', backgroundColor: 'var(--color-surface, #fff)', borderRight: '1px solid var(--color-border, #eee)', padding: '1rem' }}>
          <h2 style={{ paddingLeft: '1rem', marginBottom: '2rem' }}>Dashboard</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <NavLink to="/" style={({ isActive }) => ({ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: isActive ? 'var(--color-primary)' : 'inherit', backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent', borderRadius: '8px' })}>
              <LayoutDashboard size={20} />
              Overview
            </NavLink>
            <NavLink to="/catalog" style={({ isActive }) => ({ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: isActive ? 'var(--color-primary)' : 'inherit', backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent', borderRadius: '8px' })}>
              <PackageOpen size={20} />
              Catalog
            </NavLink>
            <NavLink to="/analytics" style={({ isActive }) => ({ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: isActive ? 'var(--color-primary)' : 'inherit', backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent', borderRadius: '8px' })}>
              <BarChart3 size={20} />
              Analytics
            </NavLink>
            <NavLink to="/z-reports" style={({ isActive }) => ({ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: isActive ? 'var(--color-primary)' : 'inherit', backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent', borderRadius: '8px' })}>
              <Receipt size={20} />
              Z-Reports
            </NavLink>
            <NavLink to="/intake" style={({ isActive }) => ({ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: isActive ? 'var(--color-primary)' : 'inherit', backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent', borderRadius: '8px' })}>
              <Settings size={20} />
              Intake
            </NavLink>
            <NavLink to="/tax-exports" style={({ isActive }) => ({ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: isActive ? 'var(--color-primary)' : 'inherit', backgroundColor: isActive ? 'var(--color-surface-hover, #f0f4ff)' : 'transparent', borderRadius: '8px' })}>
              <Download size={20} />
              Tax Exports
            </NavLink>
          </nav>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, padding: '2rem' }}>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/z-reports" element={<ZReportsPage />} />
            <Route path="/intake" element={<IntakePage />} />
            <Route path="/tax-exports" element={<TaxExportsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
