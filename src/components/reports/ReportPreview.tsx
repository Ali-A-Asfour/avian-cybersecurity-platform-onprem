/**
 * Report Preview Component
 * 
 * Provides slide-based preview of reports with zoom and navigation controls.
 * Includes loading states and error handling.
 */

'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SlideContent } from '@/types/reports';

// Component to properly render slide content
const SlideContentRenderer = ({ content }: { content: SlideContent }) => {
    return (
        <div className="space-y-6">
            {/* Heading */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold avian-text mb-2">{content.heading}</h1>
                {content.subheading && (
                    <p className="text-xl avian-text-secondary">{content.subheading}</p>
                )}
            </div>

            {/* Summary */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <p className="text-lg avian-text leading-relaxed">{content.summary}</p>
            </div>

            {/* Key Points */}
            {content.keyPoints && content.keyPoints.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xl font-semibold avian-text mb-4">Key Highlights</h3>
                    <ul className="space-y-3">
                        {content.keyPoints.map((point, index) => (
                            <li key={index} className="flex items-start space-x-3">
                                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                                <span className="text-lg avian-text-secondary leading-relaxed">{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Callouts */}
            {content.callouts && content.callouts.length > 0 && (
                <div className="space-y-4">
                    {content.callouts.map((callout, index) => (
                        <div
                            key={index}
                            className={cn(
                                "p-4 rounded-lg border-l-4 flex items-start space-x-3",
                                callout.type === 'success' && "bg-emerald-900/20 border-emerald-500",
                                callout.type === 'warning' && "bg-amber-900/20 border-amber-500",
                                callout.type === 'info' && "bg-blue-900/20 border-blue-500",
                                callout.type === 'highlight' && "bg-primary-900/20 border-primary-500"
                            )}
                        >
                            {callout.icon && (
                                <span className="text-2xl flex-shrink-0">{callout.icon}</span>
                            )}
                            <p className="avian-text-secondary leading-relaxed">{callout.text}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export interface ReportPreviewProps {
    reportType: 'weekly' | 'monthly' | 'quarterly';
    reportData?: {
        id: string;
        type: 'weekly' | 'monthly' | 'quarterly';
        dateRange: {
            startDate: string;
            endDate: string;
        };
        generatedAt: string;
        slides: any[];
    };
    className?: string;
}

interface ReportSlide {
    id: string;
    title: string;
    content: React.ReactNode | SlideContent;
    slideNumber: number;
    totalSlides: number;
}

// Executive-grade slide content with premium presentation
const generateMockSlides = (reportType: 'weekly' | 'monthly' | 'quarterly'): ReportSlide[] => {
    const baseSlides = [
        {
            id: 'cover-slide',
            title: 'Cover Slide',
            content: (
                <div className="relative h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl overflow-hidden">
                    {/* Animated Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-500/20 to-transparent animate-pulse"></div>
                        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-radial from-primary-500/10 to-transparent rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-radial from-primary-400/5 to-transparent rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
                    </div>

                    {/* Geometric Pattern Overlay */}
                    <div className="absolute inset-0 opacity-5">
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100" height="100" fill="url(#grid)" />
                        </svg>
                    </div>

                    {/* Enhanced AVIAN Branding Header */}
                    <div className="absolute top-8 left-8 flex items-center space-x-4">
                        <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-2xl">
                                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <div className="absolute -inset-1 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl blur opacity-30 animate-pulse"></div>
                        </div>
                        <div>
                            <div className="text-white font-bold text-xl tracking-wide">AVIAN</div>
                            <div className="text-slate-300 text-sm font-medium">Cybersecurity Platform</div>
                            <div className="text-slate-400 text-xs">Enterprise Security Solutions</div>
                        </div>
                    </div>

                    {/* Security Badge */}
                    <div className="absolute top-8 right-8 flex items-center space-x-2 bg-slate-800/60 backdrop-blur-sm border border-slate-600 rounded-lg px-3 py-2">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span className="text-emerald-400 text-xs font-medium">SECURE</span>
                    </div>

                    {/* Main Content with Enhanced Typography */}
                    <div className="flex flex-col justify-center items-center h-full text-center px-12">
                        <div className="mb-12 space-y-6">
                            {/* Report Type Badge */}
                            <div className="inline-flex items-center px-4 py-2 bg-primary-500/20 border border-primary-400/30 rounded-full">
                                <span className="text-primary-300 text-sm font-medium uppercase tracking-wider">
                                    {reportType} Report
                                </span>
                            </div>

                            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
                                Security Analysis
                                <span className="block text-3xl font-light text-slate-300 mt-2">
                                    & Risk Assessment
                                </span>
                            </h1>

                            <div className="space-y-2">
                                <div className="text-xl text-slate-300 font-medium">
                                    {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Comprehensive Review
                                </div>
                                <div className="text-slate-400 text-lg">
                                    Reporting Period: {new Date().toLocaleDateString()} - {new Date().toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        {/* Enhanced Client Section */}
                        <div className="relative">
                            <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 backdrop-blur-lg border border-slate-600 rounded-xl px-8 py-6 shadow-2xl">
                                <div className="flex items-center justify-center space-x-4 mb-4">
                                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <div className="text-slate-300 text-sm font-medium uppercase tracking-wider">Prepared for</div>
                                </div>
                                <div className="text-white text-2xl font-bold mb-2">[Client Organization Name]</div>
                                <div className="text-slate-400 text-sm">Executive Leadership Team</div>
                            </div>
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/20 to-amber-500/20 rounded-xl blur opacity-50"></div>
                        </div>
                    </div>

                    {/* Enhanced Footer with Additional Branding */}
                    <div className="absolute bottom-8 left-8 right-8">
                        <div className="flex justify-between items-center text-slate-400 text-sm">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>Confidential & Proprietary</span>
                                </div>
                                <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                                <span>AVIAN Cybersecurity Platform</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <span>Generated: {new Date().toLocaleDateString()}</span>
                                <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                                <span className="text-primary-400">v2.0</span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'executive-overview',
            title: 'Executive Overview',
            content: (
                <div className="space-y-8">
                    {/* Executive Summary Section with Enhanced Separator */}
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/20 to-emerald-500/20 rounded-xl blur opacity-50"></div>
                        <div className="relative bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl p-8 border border-slate-200 dark:border-slate-600 shadow-lg">
                            <div className="flex items-center mb-6">
                                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Executive Summary</h3>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">Key insights and performance highlights</p>
                                </div>
                            </div>

                            {/* Decorative Separator Line */}
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent mb-6"></div>

                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg">
                                During this reporting period, our security program successfully protected your organization by addressing <strong className="text-emerald-600 dark:text-emerald-400">247 security events</strong>,
                                implementing <strong className="text-blue-600 dark:text-blue-400">156 security enhancements</strong>, and resolving <strong className="text-purple-600 dark:text-purple-400">23 risk exposures</strong>.
                                Your security investment continues to deliver strong protection with <strong className="text-primary-600 dark:text-primary-400">94% threat prevention effectiveness</strong> and zero business disruptions.
                            </p>
                        </div>
                    </div>

                    {/* KPI Cards with Enhanced Visual Hierarchy */}
                    <div className="grid grid-cols-3 gap-6">
                        {/* Alerts Digested - Green (Success) */}
                        <div className="group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl"></div>
                            <div className="relative bg-white dark:bg-slate-800 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">247</div>
                                        <div className="text-emerald-500 text-sm font-medium">↑ 12% vs last period</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-slate-900 dark:text-white font-semibold">Security Events Managed</div>
                                    <div className="text-slate-600 dark:text-slate-400 text-sm">Threats prevented & business protected</div>
                                </div>
                                <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full" style={{ width: '87%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Updates Applied - Blue (Information) */}
                        <div className="group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl"></div>
                            <div className="relative bg-white dark:bg-slate-800 rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">156</div>
                                        <div className="text-blue-500 text-sm font-medium">↑ 8% vs last period</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-slate-900 dark:text-white font-semibold">Security Enhancements</div>
                                    <div className="text-slate-600 dark:text-slate-400 text-sm">Protective measures & system strengthening</div>
                                </div>
                                <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full" style={{ width: '94%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Vulnerabilities Mitigated - Purple (Achievement) */}
                        <div className="group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl"></div>
                            <div className="relative bg-white dark:bg-slate-800 rounded-xl p-6 border border-purple-200 dark:border-purple-800 shadow-lg hover:shadow-xl transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">23</div>
                                        <div className="text-purple-500 text-sm font-medium">↓ 15% vs last period</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-slate-900 dark:text-white font-semibold">Risk Exposures Resolved</div>
                                    <div className="text-slate-600 dark:text-slate-400 text-sm">Business risks eliminated & secured</div>
                                </div>
                                <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full" style={{ width: '76%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Risk Indicator Section */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-lg font-semibold text-slate-900 dark:text-white">Overall Security Posture</div>
                                    <div className="text-slate-600 dark:text-slate-400">Current risk level assessment</div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">LOW RISK</div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">94% Security Score</div>
                                </div>
                                <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-lg"></div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'alerts-digest',
            title: 'Threat Prevention & Response',
            content: (
                <div className="space-y-8">
                    {/* Section Header with Icon */}
                    <div className="flex items-center space-x-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Threat Prevention Results</h3>
                            <p className="text-slate-600 dark:text-slate-400">Business protection through proactive security measures</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Alert Classification with Visual Bars */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
                            <div className="flex items-center mb-6">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Threat Categories</h4>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">Phishing</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-red-500 h-2 rounded-full" style={{ width: '89%' }}></div>
                                        </div>
                                        <span className="text-lg font-bold text-slate-900 dark:text-white w-8">89</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">Malware</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-orange-500 h-2 rounded-full" style={{ width: '67%' }}></div>
                                        </div>
                                        <span className="text-lg font-bold text-slate-900 dark:text-white w-8">67</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">Network</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                                        </div>
                                        <span className="text-lg font-bold text-slate-900 dark:text-white w-8">45</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">Authentication</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-purple-500 h-2 rounded-full" style={{ width: '32%' }}></div>
                                        </div>
                                        <span className="text-lg font-bold text-slate-900 dark:text-white w-8">32</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">Other</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-slate-500 h-2 rounded-full" style={{ width: '14%' }}></div>
                                        </div>
                                        <span className="text-lg font-bold text-slate-900 dark:text-white w-8">14</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Alert Outcomes with Color-Coded Cards */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
                            <div className="flex items-center mb-6">
                                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mr-3">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Resolution Outcomes</h4>
                            </div>
                            <div className="space-y-4">
                                {/* Security Incidents - Red */}
                                <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <span className="text-slate-900 dark:text-white font-medium">Security Incidents</span>
                                        </div>
                                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">12</div>
                                    </div>
                                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">Requires immediate attention</div>
                                </div>

                                {/* Benign Activity - Green */}
                                <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <span className="text-slate-900 dark:text-white font-medium">Benign Activity</span>
                                        </div>
                                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">198</div>
                                    </div>
                                    <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">Business operations protected</div>
                                </div>

                                {/* False Positives - Yellow */}
                                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <span className="text-slate-900 dark:text-white font-medium">False Positives</span>
                                        </div>
                                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">37</div>
                                    </div>
                                    <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">Optimization opportunities identified</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Timeline Chart */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
                        <div className="flex items-center mb-6">
                            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Weekly Alert Timeline</h4>
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                                const values = [42, 38, 51, 29, 47, 15, 25];
                                const maxValue = Math.max(...values);
                                const height = (values[index] / maxValue) * 100;
                                return (
                                    <div key={day} className="text-center">
                                        <div className="h-32 flex items-end justify-center mb-2">
                                            <div
                                                className="w-8 bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-lg transition-all duration-300 hover:from-indigo-600 hover:to-indigo-500"
                                                style={{ height: `${height}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{day}</div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">{values[index]}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'vulnerability-posture',
            title: 'Vulnerability Management',
            content: (
                <div className="space-y-8">
                    {/* Section Header */}
                    <div className="flex items-center space-x-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Vulnerability Posture</h3>
                            <p className="text-slate-600 dark:text-slate-400">Risk assessment and remediation progress</p>
                        </div>
                    </div>

                    {/* Detection vs Mitigation Summary Cards */}
                    <div className="grid grid-cols-2 gap-8">
                        <div className="relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl"></div>
                            <div className="relative bg-white dark:bg-slate-800 rounded-xl p-8 border border-blue-200 dark:border-blue-800 shadow-lg">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">156</div>
                                        <div className="text-blue-500 text-sm font-medium">+12 this period</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xl font-bold text-slate-900 dark:text-white">Vulnerabilities Detected</h4>
                                    <p className="text-slate-600 dark:text-slate-400">Comprehensive security scanning results</p>
                                </div>
                                <div className="mt-6 flex items-center justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Prevention Rate</span>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">98.5%</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-xl"></div>
                            <div className="relative bg-white dark:bg-slate-800 rounded-xl p-8 border border-emerald-200 dark:border-emerald-800 shadow-lg">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">133</div>
                                        <div className="text-emerald-500 text-sm font-medium">+18 resolved</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xl font-bold text-slate-900 dark:text-white">Vulnerabilities Mitigated</h4>
                                    <p className="text-slate-600 dark:text-slate-400">Successfully patched and resolved</p>
                                </div>
                                <div className="mt-6 flex items-center justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Remediation Rate</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">85.3%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Severity Breakdown with Enhanced Visuals */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg">
                        <div className="flex items-center mb-8">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center mr-4">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white">Business Risk Assessment</h4>
                                <p className="text-slate-600 dark:text-slate-400">Risk exposure levels and business impact analysis</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Critical Vulnerabilities */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl border border-red-200 dark:border-red-800">
                                <div className="flex items-center space-x-4">
                                    <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">Critical</div>
                                        <div className="text-sm text-red-700 dark:text-red-300">Immediate action required</div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="w-48 bg-red-200 dark:bg-red-900/40 rounded-full h-3">
                                        <div className="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full shadow-sm" style={{ width: '15%' }}></div>
                                    </div>
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400 w-8">8</div>
                                </div>
                            </div>

                            {/* High Vulnerabilities */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl border border-orange-200 dark:border-orange-800">
                                <div className="flex items-center space-x-4">
                                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">High</div>
                                        <div className="text-sm text-orange-700 dark:text-orange-300">Priority remediation needed</div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="w-48 bg-orange-200 dark:bg-orange-900/40 rounded-full h-3">
                                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full shadow-sm" style={{ width: '35%' }}></div>
                                    </div>
                                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 w-8">23</div>
                                </div>
                            </div>

                            {/* Medium Vulnerabilities */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                                <div className="flex items-center space-x-4">
                                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">Medium</div>
                                        <div className="text-sm text-yellow-700 dark:text-yellow-300">Scheduled for resolution</div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="w-48 bg-yellow-200 dark:bg-yellow-900/40 rounded-full h-3">
                                        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-3 rounded-full shadow-sm" style={{ width: '80%' }}></div>
                                    </div>
                                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 w-8">125</div>
                                </div>
                            </div>
                        </div>

                        {/* Risk Reduction Progress */}
                        <div className="mt-8 p-6 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-lg font-bold text-slate-900 dark:text-white">Overall Risk Reduction</h5>
                                    <p className="text-slate-600 dark:text-slate-300">Progress toward security objectives</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">76%</div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">Remediation Rate</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
    ];

    // Add report-type specific slides
    if (reportType === 'monthly') {
        baseSlides.push({
            id: 'trends-analysis',
            title: 'Security Performance Trends',
            content: (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Security Trends & Patterns</h3>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Week-over-Week Comparison</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400">Alert Volume</span>
                                    <span className="text-green-600 dark:text-green-400 text-sm">↓ 12%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400">Critical Incidents</span>
                                    <span className="text-red-600 dark:text-red-400 text-sm">↑ 8%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400">Resolution Time</span>
                                    <span className="text-green-600 dark:text-green-400 text-sm">↓ 15%</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Top Recurring Alert Types</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Email Phishing</span>
                                    <span className="font-medium">34 incidents</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Failed Login Attempts</span>
                                    <span className="font-medium">28 incidents</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Suspicious Network Traffic</span>
                                    <span className="font-medium">19 incidents</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        });
    }

    if (reportType === 'quarterly') {
        baseSlides.push({
            id: 'business-impact',
            title: 'Business Impact Summary',
            content: (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Quarterly Security Value Delivered</h3>
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-6 rounded-lg">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Risk Reduction Achievements</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">87%</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Business Protection Rate</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">94%</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Response Effectiveness</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">76%</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Vulnerability Remediation</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Security Posture Improvements</h4>
                            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                                <li className="flex items-center">
                                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Enhanced email security reduced phishing incidents by 45%
                                </li>
                                <li className="flex items-center">
                                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Automated patch management improved compliance by 32%
                                </li>
                                <li className="flex items-center">
                                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Advanced protection prevented 23 potential business disruptions
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            ),
        });
    }

    return baseSlides.map((slide, index) => ({
        ...slide,
        slideNumber: index + 1,
        totalSlides: baseSlides.length,
    }));
};

export function ReportPreview({ reportType, reportData, className }: ReportPreviewProps) {
    const [slides, setSlides] = useState<ReportSlide[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState(100);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Load slides when report data changes
    useEffect(() => {
        if (!reportData) {
            setSlides([]);
            setCurrentSlide(0);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // Use actual report data if available, otherwise generate mock slides
        const timer = setTimeout(() => {
            try {
                let reportSlides;
                if (reportData.slides && reportData.slides.length > 0) {
                    // Use actual report slides
                    reportSlides = reportData.slides.map((slide: any, index: number) => ({
                        id: slide.id || `slide-${index}`,
                        title: slide.title || `Slide ${index + 1}`,
                        content: slide.content,
                        slideNumber: index + 1,
                        totalSlides: reportData.slides.length,
                    }));
                } else {
                    // Fallback to mock slides for preview
                    reportSlides = generateMockSlides(reportType);
                }

                setSlides(reportSlides);
                setCurrentSlide(0);
                setLoading(false);
            } catch {
                setError('Failed to load report preview');
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [reportType, reportData]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (loading || error) return;

            switch (event.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    event.preventDefault();
                    handlePreviousSlide();
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                case ' ':
                    event.preventDefault();
                    handleNextSlide();
                    break;
                case 'Home':
                    event.preventDefault();
                    handleSlideJump(0);
                    break;
                case 'End':
                    event.preventDefault();
                    handleSlideJump(slides.length - 1);
                    break;
                case 'Escape':
                    event.preventDefault();
                    setZoomLevel(100);
                    break;
                default:
                    // Number keys for direct slide navigation
                    const slideNumber = parseInt(event.key);
                    if (slideNumber >= 1 && slideNumber <= slides.length) {
                        event.preventDefault();
                        handleSlideJump(slideNumber - 1);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [loading, error, slides.length, isTransitioning]);

    const handlePreviousSlide = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentSlide((prev) => Math.max(0, prev - 1));
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const handleNextSlide = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1));
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const handleSlideJump = (slideIndex: number) => {
        if (isTransitioning || slideIndex === currentSlide) return;
        setIsTransitioning(true);
        setCurrentSlide(slideIndex);
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const handleZoomIn = () => {
        setZoomLevel((prev) => Math.min(200, prev + 25));
    };

    const handleZoomOut = () => {
        setZoomLevel((prev) => Math.max(50, prev - 25));
    };

    const handleZoomReset = () => {
        setZoomLevel(100);
    };

    if (loading) {
        return (
            <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700", className)}>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-400">Loading report preview...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700", className)}>
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const currentSlideData = slides[currentSlide];

    return (
        <div className={cn("bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700", className)}>
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Report Preview
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        Slide {currentSlideData?.slideNumber} of {currentSlideData?.totalSlides}
                    </span>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center space-x-2">
                    <Button onClick={handleZoomOut} variant="ghost" size="sm" disabled={zoomLevel <= 50}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                    </Button>
                    <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
                        {zoomLevel}%
                    </span>
                    <Button onClick={handleZoomIn} variant="ghost" size="sm" disabled={zoomLevel >= 200}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </Button>
                    <Button onClick={handleZoomReset} variant="ghost" size="sm">
                        Reset
                    </Button>
                </div>
            </div>

            {/* Slide Content */}
            <div className="p-6 overflow-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={{ maxHeight: '600px' }}>
                <style jsx>{`
                    /* Ensure preview matches PDF exactly */
                    .avian-primary { color: #00D4FF !important; }
                    .avian-secondary { color: #1A1A1A !important; }
                    .avian-accent { color: #FF6B35 !important; }
                    .avian-background { background-color: #0A0A0A !important; }
                    .avian-text { color: #FFFFFF !important; }
                    .avian-text-secondary { color: #B0B0B0 !important; }
                    
                    .gradient-bg {
                        background: linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%) !important;
                    }
                    
                    .primary-gradient {
                        background: linear-gradient(135deg, #00D4FF 0%, #0099CC 100%) !important;
                    }
                    
                    .accent-gradient {
                        background: linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%) !important;
                    }
                    
                    .glow-effect {
                        box-shadow: 0 0 20px rgba(0, 212, 255, 0.3) !important;
                    }
                `}</style>
                <div
                    className={cn(
                        "mx-auto avian-background gradient-bg rounded-xl shadow-lg glow-effect border border-slate-700 overflow-hidden transition-all duration-300",
                        isTransitioning ? "opacity-90 scale-95" : "opacity-100 scale-100"
                    )}
                    style={{
                        transform: `scale(${zoomLevel / 100}) ${isTransitioning ? 'scale(0.95)' : 'scale(1)'}`,
                        transformOrigin: 'top center',
                        width: '900px',
                        minHeight: '650px',
                        background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)'
                    }}
                >
                    <div className="p-10">
                        {currentSlideData?.id !== 'cover-slide' && (
                            <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-gradient-to-r from-primary-500 to-primary-600">
                                <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                                    {currentSlideData?.title}
                                </h2>
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">AVIAN</span>
                                </div>
                            </div>
                        )}
                        {currentSlideData?.content && (
                            typeof currentSlideData.content === 'object' &&
                                'heading' in currentSlideData.content ? (
                                <SlideContentRenderer content={currentSlideData.content as SlideContent} />
                            ) : (
                                currentSlideData.content as React.ReactNode
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Enhanced Navigation Controls */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-t border-slate-200 dark:border-slate-600">
                {/* Section Progress Indicator */}
                <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Section Progress:</span>
                            <div className="flex items-center space-x-2">
                                {slides.map((slide, index) => {
                                    const sectionNames = ['Cover', 'Overview', 'Alerts', 'Vulnerabilities', 'Trends', 'Business Impact'];
                                    const isActive = index === currentSlide;
                                    const isPast = index < currentSlide;

                                    return (
                                        <div key={index} className="flex items-center">
                                            <button
                                                onClick={() => handleSlideJump(index)}
                                                disabled={isTransitioning}
                                                className={cn(
                                                    'flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50',
                                                    isActive
                                                        ? 'bg-primary-500 text-white shadow-lg transform scale-105'
                                                        : isPast
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 hover:scale-105'
                                                            : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-500 hover:scale-105'
                                                )}
                                                aria-label={`Go to ${sectionNames[index] || `Slide ${index + 1}`}`}
                                            >
                                                <div className={cn(
                                                    'w-2 h-2 rounded-full',
                                                    isActive ? 'bg-white' : isPast ? 'bg-emerald-500' : 'bg-slate-400'
                                                )}></div>
                                                <span>{sectionNames[index] || `Slide ${index + 1}`}</span>
                                            </button>
                                            {index < slides.length - 1 && (
                                                <svg className="w-4 h-4 text-slate-400 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                {currentSlide + 1} of {slides.length} slides
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-500">
                                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">←→</kbd>
                                <span>Navigate</span>
                                <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">1-{slides.length}</kbd>
                                <span>Jump</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between p-4">
                    <Button
                        onClick={handlePreviousSlide}
                        variant="outline"
                        size="md"
                        disabled={currentSlide === 0 || isTransitioning}
                        className="flex items-center space-x-2 transition-all duration-200 hover:scale-105"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Previous Slide</span>
                    </Button>

                    {/* Current Section Info */}
                    <div className="text-center">
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                            {currentSlideData?.title}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            {currentSlide === 0 && "Report introduction and branding"}
                            {currentSlide === 1 && "Executive summary and key metrics"}
                            {currentSlide === 2 && "Threat prevention results and business protection"}
                            {currentSlide === 3 && "Risk management and business resilience"}
                            {currentSlide === 4 && "Performance trends and strategic insights"}
                            {currentSlide === 5 && "Business impact and value delivered"}
                        </div>
                    </div>

                    <Button
                        onClick={handleNextSlide}
                        variant="outline"
                        size="md"
                        disabled={currentSlide === slides.length - 1 || isTransitioning}
                        className="flex items-center space-x-2 transition-all duration-200 hover:scale-105"
                    >
                        <span>Next Slide</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Button>
                </div>
            </div>
        </div>
    );
}