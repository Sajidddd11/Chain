import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, message, Spin, Typography, Row, Col, Tabs, Table, Tag, Switch } from 'antd';
import { MapPin, Trash2, Map as MapIcon, Satellite, Save } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { analyzeField, getSavedFieldAnalysis, saveFieldAnalysis, clearFieldAnalysis } from '../../services/satelliteService';
import { useAuth } from '../../context/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const FieldAnalysisTab = () => {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const polygonRef = useRef(null);
  const farmerLocationMarkerRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [polygon, setPolygon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [currentVisualization, setCurrentVisualization] = useState('rgb');
  const [mapViewType, setMapViewType] = useState('map'); // 'map' or 'satellite'
  const [isSaved, setIsSaved] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Index descriptions
  const indexDescriptions = {
    rgb: 'True color satellite imagery showing the actual appearance of the field',
    ndvi: 'NDVI - Measures vegetation health and density',
    ndmi: 'NDMI - Indicates vegetation water content',
    ndwi: 'NDWI - Detects water bodies and moisture levels',
    ndre: 'NDRE - Sensitive to nitrogen content',
    evi: 'EVI - Enhanced vegetation index'
  };

  // Color legends for each index - Using standard scientific colormaps
  // These match common remote sensing visualization standards
  const indexLegends = {
    ndvi: {
      // Standard NDVI colormap: Red-Yellow-Green (matching actual satellite images)
      gradient: 'linear-gradient(to right, #A50026 0%, #D73027 10%, #F46D43 20%, #FDAE61 30%, #FEE08B 40%, #FFFFBF 50%, #E6F598 60%, #ABDDA4 70%, #66C2A5 80%, #228B22 85%, #006400 95%, #004D00 100%)',
      min: { value: '-1', label: 'No Vegetation', color: '#A50026' },
      mid: { value: '0.5', label: 'Moderate', color: '#FFFFBF' },
      max: { value: '1', label: 'Healthy & Dense', color: '#004D00' },
      description: 'Red/Brown = no vegetation, Yellow = moderate, Green = healthy'
    },
    ndmi: {
      // Moisture colormap: Red-Yellow-Green (matching actual satellite images)
      gradient: 'linear-gradient(to right, #A50026 0%, #D73027 10%, #F46D43 20%, #FDAE61 30%, #FEE08B 40%, #FFFFBF 50%, #E6F598 60%, #ABDDA4 70%, #66C2A5 80%, #228B22 85%, #006400 95%, #004D00 100%)',
      min: { value: '-1', label: 'Dry', color: '#A50026' },
      mid: { value: '0', label: 'Moderate', color: '#FFFFBF' },
      max: { value: '1', label: 'High Moisture', color: '#004D00' },
      description: 'Red = water stress, Yellow = moderate, Green = high moisture'
    },
    ndwi: {
      // Water index colormap: Yellow/Orange to Green (matching actual satellite images)
      gradient: 'linear-gradient(to right, #FFD700 0%, #FFA500 15%, #FF8C00 30%, #FF7F50 45%, #FF6347 60%, #32CD32 75%, #228B22 85%, #006400 95%, #004D00 100%)',
      min: { value: '-1', label: 'No Water', color: '#FFD700' },
      mid: { value: '0', label: 'Moderate', color: '#FF6347' },
      max: { value: '1', label: 'Water Body', color: '#004D00' },
      description: 'Yellow/Orange = dry land, Green = water bodies'
    },
    ndre: {
      // Similar to NDVI but optimized for nitrogen
      gradient: 'linear-gradient(to right, #A50026 0%, #D73027 10%, #F46D43 20%, #FDAE61 30%, #FEE08B 40%, #FFFFBF 50%, #E6F598 60%, #ABDDA4 70%, #66C2A5 80%, #228B22 85%, #006400 95%, #004D00 100%)',
      min: { value: '-1', label: 'Low Nitrogen', color: '#A50026' },
      mid: { value: '0.3', label: 'Moderate', color: '#FFFFBF' },
      max: { value: '1', label: 'High Nitrogen', color: '#004D00' },
      description: 'Red = nitrogen deficiency, Yellow = moderate, Green = sufficient'
    },
    evi: {
      // Enhanced vegetation index - similar to NDVI
      gradient: 'linear-gradient(to right, #A50026 0%, #D73027 10%, #F46D43 20%, #FDAE61 30%, #FEE08B 40%, #FFFFBF 50%, #E6F598 60%, #ABDDA4 70%, #66C2A5 80%, #228B22 85%, #006400 95%, #004D00 100%)',
      min: { value: '0', label: 'No Vegetation', color: '#A50026' },
      mid: { value: '0.5', label: 'Moderate', color: '#FFFFBF' },
      max: { value: '1', label: 'Dense Vegetation', color: '#004D00' },
      description: 'Red/Brown = sparse, Yellow = moderate, Green = dense healthy'
    }
  };

  // Legend component for color gradient
  const ColorLegend = ({ legend }) => {
    if (!legend) return null;

    return (
      <div style={{
        backgroundColor: '#fff',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #e8e8e8',
        marginTop: '12px'
      }}>
        {/* Gradient Bar */}
        <div style={{
          height: '20px',
          background: legend.gradient,
          borderRadius: '4px',
          border: '1px solid #d9d9d9',
          marginBottom: '8px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
        }} />
        
        {/* Labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          marginBottom: '8px'
        }}>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ 
              display: 'inline-block',
              width: '10px',
              height: '10px',
              backgroundColor: legend.min.color,
              borderRadius: '2px',
              marginRight: '4px',
              border: '1px solid #d9d9d9'
            }} />
            <span style={{ color: '#666', fontWeight: 500 }}>
              {legend.min.value}: {legend.min.label}
            </span>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ 
              display: 'inline-block',
              width: '10px',
              height: '10px',
              backgroundColor: legend.mid.color,
              borderRadius: '2px',
              marginRight: '4px',
              border: '1px solid #d9d9d9'
            }} />
            <span style={{ color: '#666', fontWeight: 500 }}>
              {legend.mid.value}: {legend.mid.label}
            </span>
          </div>
          <div style={{ textAlign: 'right', flex: 1 }}>
            <div style={{ 
              display: 'inline-block',
              width: '10px',
              height: '10px',
              backgroundColor: legend.max.color,
              borderRadius: '2px',
              marginRight: '4px',
              border: '1px solid #d9d9d9'
            }} />
            <span style={{ color: '#666', fontWeight: 500 }}>
              {legend.max.value}: {legend.max.label}
            </span>
          </div>
        </div>
        
        {/* Description */}
        <div style={{
          fontSize: '12px',
          color: '#888',
          fontStyle: 'italic',
          textAlign: 'center',
          paddingTop: '4px',
          borderTop: '1px solid #f0f0f0'
        }}>
          {legend.description}
        </div>
      </div>
    );
  };

  // Create red marker icon for farmer location
  const createRedMarkerIcon = () => {
    return L.divIcon({
      className: 'farmer-location-marker',
      html: `<div style="
        width: 24px;
        height: 24px;
        background-color: #ff4d4f;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  };

  // Initialize map and farmer location marker
  useEffect(() => {
    if (!mapInstanceRef.current && mapRef.current) {
      // Determine initial map center - use farmer location if available, otherwise default
      const defaultCenter = [24.4789, 88.6250];
      const defaultZoom = 13;
      
      let initialCenter = defaultCenter;
      let initialZoom = defaultZoom;
      
      if (user?.latitude && user?.longitude) {
        initialCenter = [user.latitude, user.longitude];
        initialZoom = 14; // Zoom in a bit more when showing farmer location
      }
      
      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true
      }).setView(initialCenter, initialZoom);

      // Start with map view
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        crossOrigin: true,
        updateWhenZooming: true,
        updateWhenIdle: true
      }).addTo(map);

      map.on('click', handleMapClick);
      
      // Fix tile loading issues by invalidating size after delays
      const timeouts = [];
      timeouts.push(setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100));
      
      timeouts.push(setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 500));
      
      // Also invalidate on window resize
      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);
      
      // Use IntersectionObserver to invalidate when map becomes visible
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && mapInstanceRef.current) {
            setTimeout(() => {
              mapInstanceRef.current.invalidateSize();
            }, 100);
          }
        });
      }, { threshold: 0.1 });
      
      if (mapRef.current) {
        observer.observe(mapRef.current);
      }
      
      // Add farmer location marker if coordinates are available
      if (user?.latitude && user?.longitude) {
        const redMarkerIcon = createRedMarkerIcon();
        farmerLocationMarkerRef.current = L.marker([user.latitude, user.longitude], {
          icon: redMarkerIcon,
          zIndexOffset: 1000 // Ensure it appears above other markers
        }).addTo(map);
        
        // Add popup with farmer location info
        const popupContent = `
          <div style="text-align: center; padding: 4px;">
            <strong style="color: #ff4d4f;">📍 Your Field Location</strong><br/>
            ${user.locationAddress || `${user.latitude.toFixed(6)}, ${user.longitude.toFixed(6)}`}
          </div>
        `;
        farmerLocationMarkerRef.current.bindPopup(popupContent);
      }
      
      mapInstanceRef.current = map;
      
      return () => {
        window.removeEventListener('resize', handleResize);
        timeouts.forEach(timeout => clearTimeout(timeout));
        observer.disconnect();
      };
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Load saved field analysis on mount
  useEffect(() => {
    const loadSavedAnalysis = async () => {
      try {
        setLoadingSaved(true);
        const result = await getSavedFieldAnalysis();
        
        if (result.success && result.data) {
          const savedData = result.data;
          setSavedAnalysisId(savedData.id);
          setIsSaved(true);
          
          // Restore coordinates and create markers
          if (savedData.field_coordinates && mapInstanceRef.current) {
            const coords = savedData.field_coordinates;
            const newMarkers = coords.map(coord => {
              return L.marker([coord[1], coord[0]]).addTo(mapInstanceRef.current);
            });
            setMarkers(newMarkers);
          }
          
          // Restore analysis result
          if (savedData.analysis_result) {
            setAnalysisResult(savedData.analysis_result);
          }
          
          message.info('Loaded saved field analysis');
        }
      } catch (error) {
        console.error('Error loading saved analysis:', error);
      } finally {
        setLoadingSaved(false);
      }
    };
    
    // Only load after map is initialized
    if (mapInstanceRef.current) {
      loadSavedAnalysis();
    }
  }, [mapInstanceRef.current]);

  // Switch between map and satellite view
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove current tile layer if it exists
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    // Add new tile layer based on view type
    if (mapViewType === 'satellite') {
      // Esri World Imagery (satellite view)
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        crossOrigin: true
      }).addTo(mapInstanceRef.current);
    } else {
      // OpenStreetMap (street map view)
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        crossOrigin: true
      }).addTo(mapInstanceRef.current);
    }
    
    // Invalidate size to ensure tiles load properly
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);
  }, [mapViewType]);

  // Handle map clicks
  const handleMapClick = (e) => {
    setMarkers(prev => {
      if (prev.length >= 4) {
        message.warning('Maximum 4 points allowed. Clear points to start over.');
        return prev;
      }

      const marker = L.marker([e.latlng.lat, e.latlng.lng], {
        draggable: true
      }).addTo(mapInstanceRef.current);

      marker.on('drag', () => {
        setMarkers(current => {
          const latlngs = current.map(m => m.getLatLng());
          updatePolygonWithMarkers(latlngs);
          return current;
        });
      });
      marker.on('click', () => {
        mapInstanceRef.current.removeLayer(marker);
        setMarkers(current => {
          const filtered = current.filter(m => m !== marker);
          if (filtered.length >= 3) {
            const latlngs = filtered.map(m => m.getLatLng());
            updatePolygonWithMarkers(latlngs);
          } else {
            if (polygonRef.current && mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(polygonRef.current);
              polygonRef.current = null;
              setPolygon(null);
            }
          }
          return filtered;
        });
      });

      return [...prev, marker];
    });
  };

  // Update polygon with marker positions
  const updatePolygonWithMarkers = (latlngs) => {
    if (polygonRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
      setPolygon(null);
    }

    if (latlngs.length >= 3 && mapInstanceRef.current) {
      const newPolygon = L.polygon(latlngs, {
        color: '#1f7a4d',
        fillColor: '#1f7a4d',
        fillOpacity: 0.2
      }).addTo(mapInstanceRef.current);
      polygonRef.current = newPolygon;
      setPolygon(newPolygon);
    }
  };

  // Update polygon when markers change
  useEffect(() => {
    if (markers.length >= 3) {
      const latlngs = markers.map(m => m.getLatLng());
      updatePolygonWithMarkers(latlngs);
    } else {
      if (polygonRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(polygonRef.current);
        polygonRef.current = null;
        setPolygon(null);
      }
    }
  }, [markers]);

  // Save field analysis to database
  const handleSaveAnalysis = async () => {
    if (!analysisResult || markers.length !== 4) {
      message.warning('Please analyze a field with 4 points before saving');
      return;
    }

    try {
      const coordinates = markers.map(marker => {
        const latlng = marker.getLatLng();
        return [latlng.lng, latlng.lat];
      });

      const result = await saveFieldAnalysis(
        coordinates, 
        analysisResult, 
        analysisResult.imagery_date || null
      );

      if (result.success) {
        setSavedAnalysisId(result.data.id);
        setIsSaved(true);
        message.success('Field analysis saved successfully!');
      }
    } catch (error) {
      console.error('Save error:', error);
      message.error('Failed to save field analysis');
    }
  };

  // Clear all markers
  const clearMarkers = async () => {
    console.log('=== Starting clearMarkers ===');
    console.log('Current markers in state:', markers.length);
    
    // Method 1: Remove from state array
    setMarkers(currentMarkers => {
      console.log('Removing markers from state, count:', currentMarkers.length);
      
      currentMarkers.forEach((marker, index) => {
        try {
          // Remove the marker from the map (but skip farmer location marker)
          if (marker && marker !== farmerLocationMarkerRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(marker);
            console.log(`Removed marker ${index + 1} via removeLayer`);
          }
        } catch (error) {
          console.error(`Error removing marker ${index + 1}:`, error);
        }
      });
      
      return [];
    });
    
    // Method 2: Remove all markers by iterating through map layers
    if (mapInstanceRef.current) {
      console.log('Scanning all map layers...');
      const layersToRemove = [];
      
      mapInstanceRef.current.eachLayer((layer) => {
        // Skip farmer location marker - don't remove it
        if (layer === farmerLocationMarkerRef.current) {
          return;
        }
        
        // Check if it's a marker (has _latlng property) or polygon (has _latlngs property)
        if (layer instanceof L.Marker) {
          console.log('Found marker layer to remove');
          layersToRemove.push(layer);
        } else if (layer instanceof L.Polygon && layer !== tileLayerRef.current) {
          console.log('Found polygon layer to remove');
          layersToRemove.push(layer);
        }
      });
      
      // Remove all found layers
      layersToRemove.forEach(layer => {
        try {
          mapInstanceRef.current.removeLayer(layer);
          console.log('Removed layer');
        } catch (error) {
          console.error('Error removing layer:', error);
        }
      });
      
      console.log(`Removed ${layersToRemove.length} layers total`);
    }
    
    // Clear polygon reference
    if (polygonRef.current) {
      try {
        if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(polygonRef.current)) {
          mapInstanceRef.current.removeLayer(polygonRef.current);
        }
        polygonRef.current = null;
        setPolygon(null);
        console.log('Polygon reference cleared');
      } catch (error) {
        console.error('Error clearing polygon:', error);
      }
    }
    
    // Clear analysis result
    setAnalysisResult(null);
    
    // Clear from database if saved
    if (isSaved) {
      try {
        await clearFieldAnalysis();
        setIsSaved(false);
        setSavedAnalysisId(null);
        message.success('Field analysis cleared from database');
      } catch (error) {
        console.error('Error clearing from database:', error);
        message.error('Failed to clear saved analysis');
      }
    }
    
    console.log('=== clearMarkers completed ===');
  };

  // Format imagery date for display
  const formatImageryDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Analyze field
  const handleAnalyzeField = async () => {
    setLoading(true);

    try {
      const coordinates = markers.map(marker => {
        const latlng = marker.getLatLng();
        return [latlng.lng, latlng.lat];
      });

      const result = await analyzeField(coordinates);
      
      if (result.success && result.data) {
        setAnalysisResult(result.data);
        setIsSaved(false); // Mark as unsaved since it's a new analysis
        message.success('Field analysis completed successfully!');
      } else {
        throw new Error('Invalid response from server');
      }

    } catch (err) {
      console.error('Analysis error:', err);
      message.error(err.message || 'Failed to analyze field. Please try again.');
      setAnalysisResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Get status tag color
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'excellent') return 'success';
    if (statusLower === 'good') return 'green';
    if (statusLower === 'moderate') return 'warning';
    if (statusLower === 'poor') return 'error';
    return 'default';
  };

  // Metrics table data
  const getMetricsData = () => {
    if (!analysisResult?.report?.raw_metrics) return [];
    
    const metrics = analysisResult.report.raw_metrics;
    return ['NDVI', 'NDMI', 'NDWI', 'NDRE', 'EVI'].map(index => ({
      key: index,
      index,
      mean: metrics[index]?.mean?.toFixed(4) || 'N/A',
      stdDev: metrics[index]?.stdDev?.toFixed(4) || 'N/A'
    }));
  };

  const metricsColumns = [
    { title: 'Index', dataIndex: 'index', key: 'index' },
    { title: 'Mean', dataIndex: 'mean', key: 'mean' },
    { title: 'Std Dev', dataIndex: 'stdDev', key: 'stdDev' }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={[16, 16]} style={{ alignItems: 'stretch' }}>
        {/* Map Section */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={20} />
                <span>Field Selection Map</span>
              </div>
            }
            extra={
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapIcon size={14} style={{ color: mapViewType === 'map' ? '#1f7a4d' : '#999' }} />
                  <Switch
                    checked={mapViewType === 'satellite'}
                    onChange={(checked) => setMapViewType(checked ? 'satellite' : 'map')}
                    size="small"
                  />
                  <Satellite size={14} style={{ color: mapViewType === 'satellite' ? '#1f7a4d' : '#999' }} />
                </div>
                <Tag color={markers.length === 4 ? 'success' : 'default'}>
                  {markers.length}/4 points
                </Tag>
                <Button 
                  size="small" 
                  onClick={clearMarkers}
                  icon={<Trash2 size={14} />}
                  disabled={markers.length === 0}
                >
                  Clear
                </Button>
              </div>
            }
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div 
              ref={mapRef} 
              style={{ 
                flex: 1,
                minHeight: '450px',
                width: '100%', 
                borderRadius: '8px',
                marginBottom: '16px',
                position: 'relative',
                zIndex: 0
              }}
            />
            
            <div style={{ 
              background: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <Text strong>Instructions:</Text>
              <ol style={{ margin: '8px 0 0 20px', fontSize: '14px' }}>
                <li>Click on the map to place 4 corner markers</li>
                <li>Drag markers to adjust positions</li>
                <li>Click on a marker to remove it</li>
                <li>Click "Analyze Field" when ready</li>
              </ol>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button 
                type="primary" 
                size="large"
                style={{ flex: 1 }}
                onClick={handleAnalyzeField}
                disabled={markers.length !== 4 || loading}
                loading={loading}
              >
                {loading ? 'Analyzing...' : 'Analyze Field'}
              </Button>
              
              {analysisResult && (
                <Button 
                  type={isSaved ? "default" : "primary"}
                  size="large"
                  icon={<Save size={18} />}
                  onClick={handleSaveAnalysis}
                  disabled={!analysisResult || markers.length !== 4 || isSaved}
                  style={{ 
                    flex: 1,
                    background: isSaved ? '#52c41a' : undefined,
                    borderColor: isSaved ? '#52c41a' : undefined,
                    color: isSaved ? '#fff' : undefined
                  }}
                >
                  {isSaved ? 'Saved' : 'Save Analysis'}
                </Button>
              )}
            </div>
          </Card>
        </Col>

        {/* Results Section */}
        <Col xs={24} lg={12}>
          {loading && (
            <Card style={{ height: '100%' }}>
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Spin size="large" />
                <Title level={4} style={{ marginTop: '20px' }}>
                  Analyzing field data from satellite imagery...
                </Title>
                <Text type="secondary">This may take 30-60 seconds</Text>
              </div>
            </Card>
          )}

          {!loading && !analysisResult && (
            <Card style={{ height: '100%' }}>
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <MapPin size={64} style={{ color: '#d0d0d0', marginBottom: '20px' }} />
                <Title level={3}>Ready to Analyze</Title>
                <Paragraph type="secondary">
                  Select 4 points on the map to define your field boundary, 
                  then click "Analyze Field" to get detailed crop health insights.
                </Paragraph>
              </div>
            </Card>
          )}

          {!loading && analysisResult && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
              {/* Summary Card */}
              <Card 
                title="📊 Field Health Summary"
                style={{ flex: '0 0 auto' }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text type="secondary">Overall Health</Text>
                    <div>
                      <Tag 
                        color={getStatusColor(analysisResult.report?.health_assessment?.status)}
                        style={{ fontSize: '14px', padding: '4px 12px' }}
                      >
                        {analysisResult.report?.health_assessment?.status || 'N/A'}
                      </Tag>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">NDVI Score</Text>
                    <div>
                      <Text strong style={{ fontSize: '18px' }}>
                        {analysisResult.report?.health_assessment?.ndvi_value?.toFixed(3) || 'N/A'}
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">Water Stress</Text>
                    <div>
                      <Text strong>
                        {analysisResult.report?.water_status?.water_stress_level || 'N/A'}
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">Analysis Time</Text>
                    <div>
                      <Text style={{ fontSize: '12px' }}>
                        {new Date(analysisResult.report?.timestamp).toLocaleString()}
                      </Text>
                    </div>
                  </Col>
                </Row>
                
                {/* Imagery Date Information */}
                {analysisResult.imagery_date && (
                  <div style={{ 
                    marginTop: '16px', 
                    paddingTop: '16px', 
                    borderTop: '1px solid #f0f0f0' 
                  }}>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                      Satellite Imagery Date:
                    </Text>
                    {analysisResult.imagery_date.most_recent_image_date ? (
                      <div>
                        <Text strong style={{ fontSize: '14px', display: 'block' }}>
                          {formatImageryDate(analysisResult.imagery_date.most_recent_image_date)}
                        </Text>
                        {analysisResult.imagery_date.image_count > 1 && (
                          <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                            ({analysisResult.imagery_date.image_count} images: {formatImageryDate(analysisResult.imagery_date.oldest_image_date)} to {formatImageryDate(analysisResult.imagery_date.most_recent_image_date)})
                          </Text>
                        )}
                      </div>
                    ) : (
                      <Text type="warning" style={{ fontSize: '13px' }}>
                        ⚠️ No recent images available
                      </Text>
                    )}
                  </div>
                )}
              </Card>

              {/* Visualizations */}
              {analysisResult.visualizations && (
                <Card 
                  title="🛰️ Satellite Visualizations"
                  style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
                  bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  <Tabs 
                    activeKey={currentVisualization}
                    onChange={setCurrentVisualization}
                    size="small"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                    tabBarStyle={{ marginBottom: '12px' }}
                  >
                    {Object.keys(indexDescriptions).map(index => (
                      <TabPane tab={index.toUpperCase()} key={index} style={{ flex: 1, overflow: 'auto' }}>
                        {analysisResult.visualizations[index] && (
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{
                              width: '100%',
                              flex: 1,
                              minHeight: '200px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              marginBottom: '12px',
                              backgroundColor: '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <img 
                                src={analysisResult.visualizations[index]}
                                alt={`${index.toUpperCase()} visualization`}
                                style={{ 
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  display: 'block'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Image failed to load</div>';
                                }}
                              />
                            </div>
                            
                            {/* Show color legend for index maps (not RGB) */}
                            {index !== 'rgb' && indexLegends[index] && (
                              <ColorLegend legend={indexLegends[index]} />
                            )}
                            
                            <Paragraph type="secondary" style={{ fontSize: '13px', marginBottom: 0, marginTop: index === 'rgb' ? 0 : 8 }}>
                              {indexDescriptions[index]}
                            </Paragraph>
                          </div>
                        )}
                      </TabPane>
                    ))}
                  </Tabs>
                </Card>
              )}
            </div>
          )}
        </Col>
      </Row>

      {/* Detailed Analysis - Full Width */}
      {!loading && analysisResult && (
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col xs={24}>
            <Card title="📝 Detailed Analysis">
              <Row gutter={[24, 24]}>
                {/* Health Details */}
                {analysisResult.report?.health_assessment && (
                  <Col xs={24} sm={12} md={8}>
                    <Title level={5} style={{ marginBottom: '16px' }}>🌱 Crop Health</Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Status:</Text>
                        <Tag color={getStatusColor(analysisResult.report.health_assessment.status)}>
                          {analysisResult.report.health_assessment.status}
                        </Tag>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Confidence:</Text>
                        <Text>{analysisResult.report.health_assessment.confidence}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Spatial Pattern:</Text>
                        <Text>{analysisResult.report.health_assessment.spatial_pattern}</Text>
                      </div>
                    </div>
                  </Col>
                )}

                {/* Water Status */}
                {analysisResult.report?.water_status && (
                  <Col xs={24} sm={12} md={8}>
                    <Title level={5} style={{ marginBottom: '16px' }}>💧 Water Status</Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Stress Level:</Text>
                        <Text strong>{analysisResult.report.water_status.water_stress_level}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>NDMI Value:</Text>
                        <Text>{analysisResult.report.water_status.ndmi_value.toFixed(3)}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Recommendation:</Text>
                        <Text style={{ textAlign: 'right', maxWidth: '60%' }}>{analysisResult.report.water_status.recommended_action}</Text>
                      </div>
                    </div>
                  </Col>
                )}

                {/* Nutrient Status */}
                {analysisResult.report?.nutrient_status && (
                  <Col xs={24} sm={12} md={8}>
                    <Title level={5} style={{ marginBottom: '16px' }}>🧪 Nutrient Status</Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Condition:</Text>
                        <Text>{analysisResult.report.nutrient_status.condition}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontWeight: 500 }}>Recommendation:</Text>
                        <Text style={{ textAlign: 'right', maxWidth: '60%' }}>{analysisResult.report.nutrient_status.recommendation}</Text>
                      </div>
                    </div>
                  </Col>
                )}

                {/* Raw Metrics */}
                {analysisResult.report?.raw_metrics && (
                  <Col xs={24} style={{ marginTop: '8px' }}>
                    <Title level={5} style={{ marginBottom: '16px' }}>📈 Raw Metrics</Title>
                    <Table 
                      dataSource={getMetricsData()}
                      columns={metricsColumns}
                      pagination={false}
                      size="small"
                    />
                  </Col>
                )}
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default FieldAnalysisTab;

