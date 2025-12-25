import { NextRequest, NextResponse } from 'next/server';
// import { logger } from '@/lib/logger';
import { ApiResponse, AgentRegistration } from '@/types';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenant_id,
      registration_token,
      hostname,
      ip_address,
      os_info,
      hardware_info,
      agent_version,
    } = body;

    // Validate required fields
    if (!tenant_id || !registration_token || !hostname || !ip_address || !os_info || !agent_version) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REGISTRATION',
          message: 'Missing required registration fields',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Create registration data
    const registrationData: Omit<AgentRegistration, 'registration_status' | 'registered_at'> = {
      agent_id: crypto.randomUUID(),
      tenant_id,
      registration_token,
      hostname,
      ip_address,
      os_info,
      hardware_info: hardware_info || {
        manufacturer: 'Unknown',
        model: 'Unknown',
        cpu: {
          model: 'Unknown',
          cores: 1,
          threads: 1,
          frequency_mhz: 0,
          architecture: 'x64',
        },
        memory: {
          total_gb: 0,
          available_gb: 0,
          type: 'Unknown',
        },
        storage: [],
        network_interfaces: [],
      },
      agent_version,
    };

    // Register the agent
    const registration = await agentService.registerAgent(registrationData);

    const response: ApiResponse = {
      success: true,
      data: {
        agent_id: registration.agent_id,
        registration_status: registration.registration_status,
        message: 'Agent registered successfully',
        next_steps: [
          'Agent will begin heartbeat communication',
          'Security tools installation will start automatically',
          'Asset discovery and inventory will commence',
        ],
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch {
    logger.error('Failed to register agent', { error });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AGENT_REGISTRATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to register agent',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}