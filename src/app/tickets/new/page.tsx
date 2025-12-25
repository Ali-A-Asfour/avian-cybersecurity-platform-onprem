'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Button } from '@/components/ui/Button';
import { useDemoContext } from '@/contexts/DemoContext';
import { UserRole } from '@/types';

export default function NewTicketPage() {
  const router = useRouter();
  const { currentUser } = useDemoContext();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    device_name: '',
    priority: 'medium',
    severity: 'medium',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isUser = currentUser.role === UserRole.USER;

  const categories = (isUser || currentUser.role === UserRole.TENANT_ADMIN) ? [
    { value: 'incident', label: 'Incident - Something isn\'t working' },
    { value: 'request', label: 'Request - I want something' },
    { value: 'security', label: 'Security - Security concern or question' },
  ] : [
    { value: 'security_incident', label: 'Security Incident' },
    { value: 'vulnerability', label: 'Vulnerability' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'access_request', label: 'Access Request' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'other', label: 'Other' },
  ];

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const severities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  const isSimplifiedForm = isUser || currentUser.role === UserRole.TENANT_ADMIN;

  const handleSubmit = async (_e: unknown) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set default priority and severity for simplified forms
      const ticketData = {
        ...formData,
        priority: isSimplifiedForm ? 'medium' : formData.priority,
        severity: isSimplifiedForm ? 'medium' : formData.severity,
        tags: [], // Remove tags for simplified forms
        assignee: null, // Remove assignee for simplified forms
      };
      
      // In real app, make API call to create ticket
      console.log('Creating ticket:', ticketData);
      
      // Redirect to tickets list
      router.push('/tickets');
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (_e: unknown) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {isSimplifiedForm ? 'Create Support Request' : 'Create New Ticket'}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {isSimplifiedForm 
              ? 'Need help? Fill out the form below and our security team will assist you.'
              : 'Create a new security ticket for tracking and resolution.'
            }
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {isSimplifiedForm ? 'What do you need help with?' : 'Title'} *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder={isSimplifiedForm ? "e.g., I can't access my account" : "Brief description of the issue"}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {isSimplifiedForm ? 'Type of request' : 'Category'} *
              </label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Device Name - Only for simplified forms */}
            {isSimplifiedForm && (
              <div>
                <label htmlFor="device_name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Device Name (if applicable)
                </label>
                <input
                  type="text"
                  id="device_name"
                  name="device_name"
                  value={formData.device_name}
                  onChange={handleChange}
                  placeholder="e.g., My laptop, Office computer, iPhone"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Help us identify which device you're having issues with
                </p>
              </div>
            )}

            {/* Priority - Only for analysts and super admins */}
            {!isSimplifiedForm && (
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Priority *
                </label>
                <select
                  id="priority"
                  name="priority"
                  required
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
                >
                  {priorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Severity - Only for analysts and super admins */}
            {!isSimplifiedForm && (
              <div>
                <label htmlFor="severity" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Severity *
                </label>
                <select
                  id="severity"
                  name="severity"
                  required
                  value={formData.severity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
                >
                  {severities.map((severity) => (
                    <option key={severity.value} value={severity.value}>
                      {severity.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {isSimplifiedForm ? 'Please describe your issue in detail' : 'Description'} *
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={6}
                value={formData.description}
                onChange={handleChange}
                placeholder={isSimplifiedForm 
                  ? "Please provide as much detail as possible. Include any error messages, when the issue started, and what you were trying to do."
                  : "Detailed description of the issue, including steps to reproduce, impact, and any relevant information."
                }
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-700 dark:text-neutral-100"
              />
            </div>

            {isSimplifiedForm && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      What happens next?
                    </h3>
                    <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Your request will be reviewed by our security team</li>
                        <li>You'll receive an email confirmation with a ticket number</li>
                        <li>We'll respond within 24 hours for standard requests</li>
                        <li>You can track progress in your dashboard</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  isSimplifiedForm ? 'Submit Request' : 'Create Ticket'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ClientLayout>
  );
}