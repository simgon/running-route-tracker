import { RoutePoint } from "../hooks/useRunningRoute";

export interface RoutePreferences {
  distance: number; // km
  difficulty: "easy" | "moderate" | "hard";
  terrain: "flat" | "hills" | "mixed";
  scenery: "urban" | "nature" | "mixed";
  avoidTraffic: boolean;
  preferParks: boolean;
}

export interface RouteAnalysis {
  elevationGain: number;
  averageGrade: number;
  trafficScore: number; // 0-100 (低いほど良い)
  safetyScore: number; // 0-100 (高いほど良い)
  sceneryScore: number; // 0-100 (高いほど良い)
  overallScore: number; // 0-100 (総合評価)
}

export class AIRouteGenerator {
  private static instance: AIRouteGenerator;
  private directionsService: google.maps.DirectionsService;
  private elevationService: google.maps.ElevationService;

  private constructor() {
    this.directionsService = new google.maps.DirectionsService();
    this.elevationService = new google.maps.ElevationService();
  }

  public static getInstance(): AIRouteGenerator {
    if (!AIRouteGenerator.instance) {
      AIRouteGenerator.instance = new AIRouteGenerator();
    }
    return AIRouteGenerator.instance;
  }

  /**
   * AI powered route generation
   */
  public async generateOptimizedRoutes(
    center: google.maps.LatLngLiteral,
    preferences: RoutePreferences
  ): Promise<RoutePoint[][]> {
    try {
      // 1. Generate multiple route candidates
      const routeCandidates = await this.generateRouteCandidates(center, preferences);
      
      // 2. Analyze each route
      const analyzedRoutes = await Promise.all(
        routeCandidates.map(async (route) => {
          const analysis = await this.analyzeRoute(route, preferences);
          return { route, analysis };
        })
      );

      // 3. Sort by AI score and return top 3
      analyzedRoutes.sort((a, b) => b.analysis.overallScore - a.analysis.overallScore);
      
      return analyzedRoutes.slice(0, 3).map(item => item.route);
    } catch (error) {
      console.error("AI route generation failed:", error);
      // Fallback to geometric route generation
      return this.generateGeometricRoutes(center, preferences);
    }
  }

  /**
   * Generate route candidates using Google Maps Directions API
   */
  private async generateRouteCandidates(
    center: google.maps.LatLngLiteral,
    preferences: RoutePreferences
  ): Promise<RoutePoint[][]> {
    const routes: RoutePoint[][] = [];
    const targetDistance = preferences.distance * 1000; // km to meters
    
    // Generate waypoints in different patterns
    const patterns = [
      this.generateCircularWaypoints(center, targetDistance),
      this.generateFigureEightWaypoints(center, targetDistance),
      this.generateOutAndBackWaypoints(center, targetDistance)
    ];

    for (const waypoints of patterns) {
      try {
        const route = await this.getDirectionsRoute(center, waypoints, preferences);
        if (route) {
          routes.push(route);
        }
      } catch (error) {
        console.warn("Failed to generate route for pattern:", error);
      }
    }

    return routes;
  }

  /**
   * Get route from Google Directions API
   */
  private async getDirectionsRoute(
    start: google.maps.LatLngLiteral,
    waypoints: google.maps.LatLngLiteral[],
    preferences: RoutePreferences
  ): Promise<RoutePoint[] | null> {
    return new Promise((resolve) => {
      const request: google.maps.DirectionsRequest = {
        origin: start,
        destination: start, // Loop back to start
        waypoints: waypoints.map(wp => ({ location: wp, stopover: false })),
        travelMode: google.maps.TravelMode.WALKING,
        avoidHighways: true,
        avoidTolls: true,
        optimizeWaypoints: true,
      };

      this.directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const route = this.convertDirectionsToRoutePoints(result);
          resolve(route);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Convert Google Directions result to RoutePoint array
   */
  private convertDirectionsToRoutePoints(result: google.maps.DirectionsResult): RoutePoint[] {
    const points: RoutePoint[] = [];
    const route = result.routes[0];
    
    route.legs.forEach((leg) => {
      leg.steps.forEach((step) => {
        const path = step.path;
        path.forEach((point, index) => {
          points.push({
            lat: point.lat(),
            lng: point.lng(),
            accuracy: 5,
            timestamp: Date.now() + points.length * 1000,
          });
        });
      });
    });

    return points;
  }

  /**
   * Analyze route quality using multiple factors
   */
  private async analyzeRoute(
    route: RoutePoint[],
    preferences: RoutePreferences
  ): Promise<RouteAnalysis> {
    // Get elevation data
    const elevationData = await this.getElevationData(route);
    
    // Calculate metrics
    const elevationGain = this.calculateElevationGain(elevationData);
    const averageGrade = this.calculateAverageGrade(route, elevationData);
    
    // Estimate other scores (in real implementation, use external APIs)
    const trafficScore = this.estimateTrafficScore(route, preferences);
    const safetyScore = this.estimateSafetyScore(route, preferences);
    const sceneryScore = this.estimateSceneryScore(route, preferences);
    
    // Calculate overall AI score
    const overallScore = this.calculateOverallScore({
      elevationGain,
      averageGrade,
      trafficScore,
      safetyScore,
      sceneryScore,
      overallScore: 0, // Will be calculated
    }, preferences);

    return {
      elevationGain,
      averageGrade,
      trafficScore,
      safetyScore,
      sceneryScore,
      overallScore,
    };
  }

  /**
   * Get elevation data for route points
   */
  private async getElevationData(route: RoutePoint[]): Promise<number[]> {
    return new Promise((resolve) => {
      const locations = route.map(point => new google.maps.LatLng(point.lat, point.lng));
      
      this.elevationService.getElevationForLocations({
        locations: locations,
      }, (results, status) => {
        if (status === google.maps.ElevationStatus.OK && results) {
          const elevations = results.map(result => result.elevation);
          resolve(elevations);
        } else {
          // Fallback: generate estimated elevations
          resolve(route.map(() => 0));
        }
      });
    });
  }

  /**
   * Calculate total elevation gain
   */
  private calculateElevationGain(elevations: number[]): number {
    let gain = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) {
        gain += diff;
      }
    }
    return gain;
  }

  /**
   * Calculate average grade percentage
   */
  private calculateAverageGrade(route: RoutePoint[], elevations: number[]): number {
    if (route.length < 2) return 0;
    
    let totalDistance = 0;
    let weightedGrade = 0;
    
    for (let i = 1; i < route.length; i++) {
      const distance = this.calculateDistance(route[i - 1], route[i]);
      const elevationDiff = elevations[i] - elevations[i - 1];
      const grade = distance > 0 ? (elevationDiff / distance) * 100 : 0;
      
      weightedGrade += Math.abs(grade) * distance;
      totalDistance += distance;
    }
    
    return totalDistance > 0 ? weightedGrade / totalDistance : 0;
  }

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(point1: RoutePoint, point2: RoutePoint): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate traffic score (0-100, lower is better)
   */
  private estimateTrafficScore(route: RoutePoint[], preferences: RoutePreferences): number {
    // In real implementation, use Google Maps Traffic API or other traffic data
    let score = 50; // Base score
    
    if (preferences.avoidTraffic) {
      score -= 20; // Bonus for avoiding traffic
    }
    
    // Estimate based on area density (simplified)
    score += route.length > 50 ? 10 : -10; // More points = more detailed route = less main roads
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate safety score (0-100, higher is better)
   */
  private estimateSafetyScore(route: RoutePoint[], preferences: RoutePreferences): number {
    let score = 70; // Base score
    
    if (preferences.preferParks) {
      score += 15; // Parks are generally safer
    }
    
    if (preferences.avoidTraffic) {
      score += 10; // Less traffic = safer
    }
    
    // Estimate based on route complexity (more turns = potentially safer residential areas)
    const complexity = this.calculateRouteComplexity(route);
    score += complexity > 0.5 ? 10 : -5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate scenery score (0-100, higher is better)
   */
  private estimateSceneryScore(route: RoutePoint[], preferences: RoutePreferences): number {
    let score = 60; // Base score
    
    switch (preferences.scenery) {
      case "nature":
        score += preferences.preferParks ? 25 : 10;
        break;
      case "urban":
        score += preferences.preferParks ? -5 : 15;
        break;
      case "mixed":
        score += 10;
        break;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate overall AI score
   */
  private calculateOverallScore(analysis: RouteAnalysis, preferences: RoutePreferences): number {
    let score = 0;
    
    // Difficulty matching
    const difficultyScore = this.getDifficultyScore(analysis, preferences.difficulty);
    score += difficultyScore * 0.3;
    
    // Safety weight
    score += analysis.safetyScore * 0.25;
    
    // Traffic weight
    score += (100 - analysis.trafficScore) * 0.2;
    
    // Scenery weight
    score += analysis.sceneryScore * 0.15;
    
    // Terrain preference
    const terrainScore = this.getTerrainScore(analysis, preferences.terrain);
    score += terrainScore * 0.1;
    
    return Math.max(0, Math.min(100, score));
  }

  private getDifficultyScore(analysis: RouteAnalysis, difficulty: string): number {
    const grade = analysis.averageGrade;
    
    switch (difficulty) {
      case "easy":
        return grade < 2 ? 100 : Math.max(0, 100 - grade * 20);
      case "moderate":
        return grade >= 2 && grade <= 5 ? 100 : Math.max(0, 100 - Math.abs(grade - 3.5) * 15);
      case "hard":
        return grade > 4 ? 100 : Math.max(0, grade * 20);
      default:
        return 50;
    }
  }

  private getTerrainScore(analysis: RouteAnalysis, terrain: string): number {
    const gain = analysis.elevationGain;
    
    switch (terrain) {
      case "flat":
        return gain < 50 ? 100 : Math.max(0, 100 - gain / 2);
      case "hills":
        return gain > 100 ? 100 : Math.max(0, gain);
      case "mixed":
        return gain >= 25 && gain <= 100 ? 100 : Math.max(0, 100 - Math.abs(gain - 62.5));
      default:
        return 50;
    }
  }

  private calculateRouteComplexity(route: RoutePoint[]): number {
    if (route.length < 3) return 0;
    
    let totalAngleChange = 0;
    
    for (let i = 1; i < route.length - 1; i++) {
      const angle1 = Math.atan2(route[i].lat - route[i - 1].lat, route[i].lng - route[i - 1].lng);
      const angle2 = Math.atan2(route[i + 1].lat - route[i].lat, route[i + 1].lng - route[i].lng);
      const angleChange = Math.abs(angle2 - angle1);
      totalAngleChange += Math.min(angleChange, 2 * Math.PI - angleChange);
    }
    
    return totalAngleChange / (route.length - 2) / Math.PI;
  }

  // Waypoint generation methods
  private generateCircularWaypoints(center: google.maps.LatLngLiteral, distance: number): google.maps.LatLngLiteral[] {
    const radius = distance / (2 * Math.PI);
    const waypoints: google.maps.LatLngLiteral[] = [];
    
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI;
      const lat = center.lat + (Math.sin(angle) * radius / 111320);
      const lng = center.lng + (Math.cos(angle) * radius / (111320 * Math.cos(center.lat * Math.PI / 180)));
      waypoints.push({ lat, lng });
    }
    
    return waypoints;
  }

  private generateFigureEightWaypoints(center: google.maps.LatLngLiteral, distance: number): google.maps.LatLngLiteral[] {
    const radius = distance / (4 * Math.PI);
    const waypoints: google.maps.LatLngLiteral[] = [];
    
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * 4 * Math.PI;
      const x = Math.sin(t) * radius;
      const y = Math.sin(t) * Math.cos(t) * radius;
      
      const lat = center.lat + (y / 111320);
      const lng = center.lng + (x / (111320 * Math.cos(center.lat * Math.PI / 180)));
      waypoints.push({ lat, lng });
    }
    
    return waypoints;
  }

  private generateOutAndBackWaypoints(center: google.maps.LatLngLiteral, distance: number): google.maps.LatLngLiteral[] {
    const halfDistance = distance / 2;
    const bearing = Math.random() * 2 * Math.PI; // Random direction
    
    const endLat = center.lat + (Math.sin(bearing) * halfDistance / 111320);
    const endLng = center.lng + (Math.cos(bearing) * halfDistance / (111320 * Math.cos(center.lat * Math.PI / 180)));
    
    return [{ lat: endLat, lng: endLng }];
  }

  /**
   * Fallback geometric route generation (when API fails)
   */
  private generateGeometricRoutes(center: google.maps.LatLngLiteral, preferences: RoutePreferences): RoutePoint[][] {
    const routes: RoutePoint[][] = [];
    const baseDistance = preferences.distance * 1000;
    
    // Generate 3 different geometric patterns
    const patterns = [
      this.generateCircularWaypoints(center, baseDistance),
      this.generateFigureEightWaypoints(center, baseDistance),
      this.generateOutAndBackWaypoints(center, baseDistance)
    ];

    patterns.forEach((waypoints, patternIndex) => {
      const route: RoutePoint[] = [
        {
          lat: center.lat,
          lng: center.lng,
          accuracy: 5,
          timestamp: Date.now(),
        }
      ];

      waypoints.forEach((waypoint, index) => {
        route.push({
          lat: waypoint.lat,
          lng: waypoint.lng,
          accuracy: 5,
          timestamp: Date.now() + (index + 1) * 1000,
        });
      });

      // Close the loop
      route.push({
        lat: center.lat,
        lng: center.lng,
        accuracy: 5,
        timestamp: Date.now() + (waypoints.length + 1) * 1000,
      });

      routes.push(route);
    });

    return routes;
  }
}