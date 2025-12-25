'use client';

import React, { useState } from 'react';
import { UserRole } from '@/types';

interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  tenant: string;
  description: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    id: '1',
    name: 'Abdullah Asfour',
    email: 'abdullah.asfour@acmecorp.com',
    role: UserRole.SUPER_ADMIN,
    avatar: 'AA',
    tenant: 'Platform Admin',
    description: 'Platform Super Administrator - manages all tenants and system-wide settings'
  },
  {
    id: '2',
    name: 'Anita V',
    email: 'anita.v@acmecorp.com',
    role: UserRole.TENANT_ADMIN,
    avatar: 'AV',
    tenant: 'ACME Corp',
    description: 'Tenant Administrator - manages ACME Corp tenant, users, and configurations'
  },
  {
    id: '3',
    name: 'Ali Asfour',
    email: 'ali.asfour@acmecorp.com',
    role: UserRole.SECURITY_ANALYST,
    avatar: 'AA',
    tenant: 'ACME Corp',
    description: 'Security Analyst - handles security tickets, alerts, and compliance tasks'
  },
  {
    id: '4',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@acmecorp.com',
    role: UserRole.IT_HELPDESK_ANALYST,
    avatar: 'SM',
    tenant: 'ACME Corp',
    description: 'IT Helpdesk Analyst - handles IT support tickets and technical assistance requests'
  },
  {
    id: '5',
    name: 'Mr Linux',
    email: 'mr.linux@acmecorp.com',
    role: UserRole.USER,
    avatar: 'ML',
    tenant: 'ACME Corp',
    description: 'End User - can create tickets and view basic security information'
  }
];

interface RoleSwitcherProps {
  currentUser: DemoUser;
  onUserChange: (user: DemoUser) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function RoleSwitcher({ currentUser, onUserChange, isOpen, onToggle }: RoleSwitcherProps) {
  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case UserRole.TENANT_ADMIN:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case UserRole.SECURITY_ANALYST:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case UserRole.IT_HELPDESK_ANALYST:
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case UserRole.USER:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      case UserRole.TENANT_ADMIN:
        return 'Tenant Admin';
      case UserRole.SECURITY_ANALYST:
        return 'Security Analyst';
      case UserRole.IT_HELPDESK_ANALYST:
        return 'IT Helpdesk Analyst';
      case UserRole.USER:
        return 'User';
      default:
        return role;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Demo Mode Badge */}
      <div className="mb-2 flex justify-end">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Demo Mode
        </span>
      </div>

      {/* Role Switcher Button */}
      <button
        onClick={onToggle}
        className="flex items-center space-x-3 p-3 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 hover:shadow-xl transition-all duration-200"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">{currentUser.avatar}</span>
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{currentUser.name}</p>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(currentUser.role)}`}>
              {getRoleLabel(currentUser.role)}
            </span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Switch User Profile</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Experience different user roles and permissions</p>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {DEMO_USERS.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onUserChange(user);
                  onToggle();
                }}
                className={`w-full p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors ${
                  currentUser.id === user.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-medium">{user.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{user.name}</p>
                      {currentUser.id === user.id && (
                        <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{user.email}</p>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                      <span className="text-xs text-neutral-400">{user.tenant}</span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-2 leading-relaxed">{user.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { DEMO_USERS, type DemoUser };