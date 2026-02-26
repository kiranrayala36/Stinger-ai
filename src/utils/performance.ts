/**
 * Performance monitoring utilities for StingerAI
 * These functions help track and identify performance issues
 */

import { InteractionManager } from 'react-native';

// Simple timing utility to measure function execution time
export function measurePerformance<T>(label: string, fn: () => T): T {
  const startTime = performance.now();
  const result = fn();
  const endTime = performance.now();
  // console.log(`⏱️ [Performance] ${label}: ${(endTime - startTime).toFixed(2)}ms`);
  return result;
}

// Measure async function performance
export async function measureAsyncPerformance<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  // console.log(`⏱️ [Performance] ${label}: ${(endTime - startTime).toFixed(2)}ms`);
  return result;
}

// Track component render time
export class RenderPerformanceMonitor {
  private name: string;
  private startTime: number;

  constructor(componentName: string) {
    this.name = componentName;
    this.startTime = performance.now();
  }

  end() {
    const duration = performance.now() - this.startTime;
    if (duration > 16) { // Frame drop threshold (60fps)
      // console.warn(`⚠️ [Slow Render] ${this.name}: ${duration.toFixed(2)}ms`);
    } else {
      // console.log(`✅ [Render] ${this.name}: ${duration.toFixed(2)}ms`);
    }
  }
}

// Run heavy work on the JS thread after animations complete
export async function measureBackgroundTask(taskName: string, task: () => Promise<void>): Promise<void> {
  const startTime = performance.now();
  await task();
  const endTime = performance.now();
  // console.log(`🔄 [Background Task] ${taskName}: ${(endTime - startTime).toFixed(2)}ms`);
}

// Memory usage monitoring (basic)
export function logMemoryUsage() {
  try {
    // @ts-ignore - performance.memory is a non-standard API
    if (performance && performance.memory) {
      // @ts-ignore - Accessing non-standard memory API properties
      const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
      // console.log(`📊 [Memory] Used: ${(usedJSHeapSize / 1048576).toFixed(2)}MB, ` +
      //   `Total: ${(totalJSHeapSize / 1048576).toFixed(2)}MB`);
    } else {
      // console.log('📊 [Memory] Memory usage stats not available');
    }
  } catch (error) {
    // console.log('📊 [Memory] Error accessing memory stats');
  }
}

// Track API calls performance
export class APIPerformanceMonitor {
  private endpoint: string;
  private startTime: number;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.startTime = performance.now();
  }

  end() {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    if (duration > 1000) { // 1 second threshold
      // console.warn(`⚠️ [Slow API] ${this.endpoint}: ${duration.toFixed(2)}ms`);
    } else {
      // console.log(`🔄 [API] ${this.endpoint}: ${duration.toFixed(2)}ms`);
    }
  }

  error(error: Error) {
    const endTime = performance.now();
    // console.error(`❌ [API Error] ${this.endpoint}: ${(endTime - this.startTime).toFixed(2)}ms`, error);
  }
}

// Export performance monitoring object for ease of use
export const Performance = {
  measure: measurePerformance,
  measureAsync: measureAsyncPerformance,
  createTimer: (name: string) => new RenderPerformanceMonitor(name),
  runAfterInteractions: measureBackgroundTask,
  logMemoryUsage,
  trackApiCall: (apiCall: () => Promise<any>, endpoint: string) => {
    const monitor = new APIPerformanceMonitor(endpoint);
    return {
      end: monitor.end.bind(monitor),
      error: monitor.error.bind(monitor)
    };
  },
}; 