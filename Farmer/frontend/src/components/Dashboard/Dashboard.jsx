import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DeviceManager from './DeviceManager';
import SensorOverview from './SensorOverview';
import WeatherWidget from '../Weather/WeatherWidget';
import AnalyticsPage from '../Analytics/AnalyticsPage';
import Chatbot from '../Chatbot/Chatbot';
import ChatbotButton from '../Chatbot/ChatbotButton';
import AdminDashboard from './AdminDashboard';
import AdminPrices from './AdminPrices';
import SellPage from './Sell/SellPage';
import FarmerPrices from './FarmerPrices';
import FieldAnalysisTab from './FieldAnalysisTab';
import LanguageToggle from '../common/LanguageToggle';
import useTranslation from '../../hooks/useTranslation';
import { authAPI } from '../../services/api';
import { Sprout, LayoutDashboard, Cpu, BarChart3, User, Phone, BadgeCheck, Leaf, MapPin, Ruler, Menu, X, Banknote, ShoppingCart, Map } from 'lucide-react';
const Dashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);
  const [isUpdatingCallAlert, setIsUpdatingCallAlert] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleCallAlertToggle = async () => {
    if (!user || isUpdatingCallAlert) return;

    const nextValue = !user.wantsCallAlert;
    setIsUpdatingCallAlert(true);
    try {
      await authAPI.updatePreferences({ wantsCallAlert: nextValue });
      updateUser({ wantsCallAlert: nextValue });
    } catch (error) {
      console.error('Failed to update call alert preference:', error);
      alert('Failed to update call alert preference. Please try again.');
    } finally {
      setIsUpdatingCallAlert(false);
    }
  };

  return (
    <div className="dashboard-fullscreen">
      {/* Top Navigation Bar */}
      <div className="dashboard-navbar">
        <div className="navbar-left">
          <div className="brand-row">
            {isMobile && (
              <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar">
                <Menu />
              </button>
            )}
            <Sprout className="brand-icon" aria-hidden="true" />
            {!isMobile && <h1 className="navbar-title">{t('app.name')}</h1>}
          </div>
          {!isMobile && <span className="navbar-subtitle">{t('app.subtitle')}</span>}
        </div>
        <div className="navbar-center">
          <div className={`date-time ${isMobile ? 'compact' : ''}`} style={{ textAlign: 'center', width: '100%' }}>
            <span className="current-date">{isMobile ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : getCurrentDate()}</span>
            <span className="current-time">{getCurrentTime()}</span>
          </div>
        </div>
        <div className="navbar-right">
          {!isMobile && (
            <div className="user-profile">
              <span className="user-name">{user?.fullName}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          )}
          {!isMobile && (
            <button onClick={handleLogout} className="logout-btn">
              {t('nav.logout')}
            </button>
          )}
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="dashboard-main">
        {/* Sidebar Backdrop (mobile) */}
        {isMobile && (
          <div className={`sidebar-backdrop ${isSidebarOpen ? 'visible' : ''}`} onClick={() => setIsSidebarOpen(false)} />
        )}
        {/* Left Sidebar - User Info */}
        <div className={`dashboard-sidebar ${isMobile && isSidebarOpen ? 'open' : ''}`}>
          {isMobile && (
            <div className="sidebar-mobile-header">
              <h3 className="section-title">Menu</h3>
              <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
                <X />
              </button>
            </div>
          )}
          <div className="sidebar-section language-section">
            <h3 className="section-title">{t('language.toggle')}</h3>
            <div className="sidebar-language-toggle">
              <LanguageToggle />
            </div>
          </div>
          
          <div className="sidebar-section">
            <h3 className="section-title">{t('profile.title')}</h3>
            <div className="profile-details">
              <div className="profile-item">
                <span className="profile-label label-with-icon"><User className="label-icon" aria-hidden="true" /> {t('profile.fullName')}</span>
                <span className="profile-value">{user?.fullName}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label label-with-icon"><Phone className="label-icon" aria-hidden="true" /> {t('profile.mobile')}</span>
                <span className="profile-value">{user?.mobileNumber}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label label-with-icon"><BadgeCheck className="label-icon" aria-hidden="true" /> {t('profile.role')}</span>
                <span className={`profile-value role-badge ${user?.role}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {user?.role === 'farmer' && (
            <>
              <div className="sidebar-section">
                <h3 className="section-title">{t('farm.title')}</h3>
                <div className="farm-details">
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><Leaf className="label-icon" aria-hidden="true" /> {t('farm.cropType')}</span>
                    <span className="farm-value">{user?.cropName}</span>
                  </div>
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><MapPin className="label-icon" aria-hidden="true" /> {t('farm.district')}</span>
                    <span className="farm-value">{user?.district || t('farm.notSpecified')}</span>
                  </div>
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><Ruler className="label-icon" aria-hidden="true" /> {t('farm.landSize')}</span>
                    <span className="farm-value">
                      {user?.landSizeAcres ? `${user.landSizeAcres} acres` : t('farm.notSpecified')}
                    </span>
                  </div>
                  {user?.locationAddress && (
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><MapPin className="label-icon" aria-hidden="true" /> {t('farm.location')}</span>
                    <span className="farm-value location">{user.locationAddress}</span>
                  </div>
                )}
              </div>
            </div>
            </>
          )}

          {user?.role === 'farmer' && (
            <div className="sidebar-section call-alert-section">
              <h3 className="section-title">Call Alerts</h3>
              <p className="sidebar-description">
                Enable automated phone calls for critical farm alerts.
              </p>
              <div className="call-alert-toggle-row">
                <label className={`toggle-switch ${isUpdatingCallAlert ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!user?.wantsCallAlert}
                    onChange={handleCallAlertToggle}
                    disabled={isUpdatingCallAlert}
                  />
                  <span className="toggle-slider" />
                </label>
                <span className="toggle-status">
                  {isUpdatingCallAlert
                    ? 'Saving...'
                    : user?.wantsCallAlert ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          )}

          {isMobile && (
            <div className="sidebar-section sidebar-actions-mobile">
              <button onClick={handleLogout} className="btn">{t('nav.logout')}</button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="dashboard-content">
          {/* Tab Navigation */}
          {user?.role === 'farmer' && (
            <div className="tab-navigation">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                title={t('nav.overview')}
              >
                <LayoutDashboard className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.overview')}
              </button>
              <button
                className={`tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
                onClick={() => setActiveTab('devices')}
                title={t('nav.devices')}
              >
                <Cpu className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.devices')}
              </button>
              <button
                className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
                title={t('nav.analytics')}
              >
                <BarChart3 className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.analytics')}
              </button>
              <button
                className={`tab-btn ${activeTab === 'field-analysis' ? 'active' : ''}`}
                onClick={() => setActiveTab('field-analysis')}
                title={t('nav.fieldAnalysis')}
              >
                <Map className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.fieldAnalysis')}
              </button>
              <button
                className={`tab-btn ${activeTab === 'prices' ? 'active' : ''}`}
                onClick={() => setActiveTab('prices')}
                title={t('nav.prices')}
              >
                <Banknote className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.prices')}
              </button>
              <button
                className={`tab-btn ${activeTab === 'sell' ? 'active' : ''}`}
                onClick={() => setActiveTab('sell')}
                title={t('nav.sell')}
              >
                <ShoppingCart className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.sell')}
              </button>
            </div>
          )}

          {/* Admin Tab Navigation */}
          {user?.role === 'admin' && (
            <div className="tab-navigation">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                title={t('nav.overview')}
              >
                <LayoutDashboard className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.overview')}
              </button>
              <button
                className={`tab-btn ${activeTab === 'prices' ? 'active' : ''}`}
                onClick={() => setActiveTab('prices')}
                title={t('nav.prices')}
              >
                <Banknote className="tab-icon" aria-hidden="true" />
                {!isMobile && t('nav.prices')}
              </button>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'overview' && user?.role === 'farmer' && (
            <div className="content-sections">
              <div className="content-section">
                <h3 className="content-title">
                  {t('dashboard.welcome')}, {user?.fullName}!
                </h3>
                <div className="welcome-content">
                  <p>
                    {user?.role === 'farmer' 
                      ? t('dashboard.farmerMsg')
                      : t('dashboard.adminMsg')
                    }
                  </p>
                  {user?.role === 'farmer' && (
                    <div className="farmer-summary">
                      <h4>{t('dashboard.summary')}</h4>
                      <ul>
                        <li><strong>{t('dashboard.crop')}</strong> {user?.cropName}</li>
                        <li><strong>{t('dashboard.location')}</strong> {user?.district}</li>
                        <li><strong>{t('dashboard.landSize')}</strong> {user?.landSizeAcres ? `${user.landSizeAcres} acres` : t('farm.notSpecified')}</li>
                        {user?.locationAddress && (
                          <li><strong>{t('dashboard.address')}</strong> {user.locationAddress}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Weather Widget in Overview */}
              {user?.role === 'farmer' && (
                <div className="content-section">
                  <h3 className="content-title">{t('weather.title')}</h3>
                  <WeatherWidget />
                </div>
              )}
            </div>
          )}

          {activeTab === 'overview' && user?.role === 'admin' && (
            <div className="content-sections">
              <div className="content-section">
                <AdminDashboard />
              </div>
            </div>
          )}

          {activeTab === 'devices' && user?.role === 'farmer' && (
            <div className="content-sections">
              <div className="content-section">
                <DeviceManager user={user} />
              </div>
            </div>
          )}

          {activeTab === 'analytics' && user?.role === 'farmer' && (
            <div className="analytics-section">
              <AnalyticsPage />
            </div>
          )}

          {activeTab === 'field-analysis' && user?.role === 'farmer' && (
            <div className="content-sections">
              <FieldAnalysisTab />
            </div>
          )}

          {activeTab === 'prices' && user?.role === 'farmer' && (
            <div className="content-sections">
              <FarmerPrices />
            </div>
          )}

          {activeTab === 'sell' && user?.role === 'farmer' && (
            <div className="content-sections">
              <SellPage />
            </div>
          )}

          {activeTab === 'prices' && user?.role === 'admin' && (
            <div className="content-sections">
              <AdminPrices />
            </div>
          )}

        </div>
      </div>

      {/* Floating Chatbot Button - Only for farmers */}
      {user?.role === 'farmer' && (
        <>
          <ChatbotButton 
            onClick={() => setIsChatbotOpen(true)}
            hasNewMessage={false}
          />
          <Chatbot 
            isOpen={isChatbotOpen}
            onClose={() => setIsChatbotOpen(false)}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;
