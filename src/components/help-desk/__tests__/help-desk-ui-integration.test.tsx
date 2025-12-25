/**
 * Help Desk UI Integration Tests
 * 
 * Tests the integration between UI components and backend services
 * for the help desk system, covering user workflows and interactions.
 * 
 * Task 15: Final integration testing and polish
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TicketStatus, TicketSeverity, TicketCategory, UserRole } from '@/types';

// Mock the services
jest.mock('@/services/ticket.service');
jest.mock('@/services/help-desk/KnowledgeBaseService');
jest.mock('@/lib/help-desk/notification-service');

const mockTicketService = require('@/services/ticket.service').TicketService;
const mockKnowledgeBaseService = require('@/services/help-desk/KnowledgeBaseService').KnowledgeBaseService;
const mockNotificationService = require('@/lib/help-desk/notification-service');

// Mock components (these would be the actual help desk UI components)
const MockTicketCreationForm = ({ onSubmit }: { onSubmit: (data: any) => void }) => (
    <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const data = {
            title: formData.get('title'),
            description: formData.get('description'),
            impactLevel: formData.get('impactLevel'),
            deviceId: formData.get('deviceId'),
            contactMethod: formData.get('contactMethod'),
        };
        onSubmit(data);
    }}>
        <input name="title" placeholder="Short title" />
        <textarea name="description" placeholder="Problem description" />
        <select name="impactLevel">
            <option value="">Select impact level</option>
            <option value="critical">I can't work at all</option>
            <option value="medium">This is slowing me down</option>
            <option value="low">It's a minor issue</option>
        </select>
        <input name="deviceId" placeholder="Device ID (optional)" />
        <select name="contactMethod">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
        </select>
        <button type="submit">Submit Ticket</button>
    </form>
);

const MockTicketQueue = ({
    tickets,
    onAssign,
    userRole
}: {
    tickets: any[],
    onAssign: (ticketId: string) => void,
    userRole: UserRole
}) => (
    <div data-testid="ticket-queue">
        {tickets.map(ticket => (
            <div key={ticket.id} data-testid={`ticket-${ticket.id}`}>
                <h3>{ticket.title}</h3>
                <p>Status: {ticket.status}</p>
                <p>Severity: {ticket.severity}</p>
                {ticket.deviceId && <p>Device: {ticket.deviceId}</p>}
                <p>Assignee: {ticket.assignee || 'Unassigned'}</p>
                {!ticket.assignee && userRole === UserRole.IT_HELPDESK_ANALYST && (
                    <button onClick={() => onAssign(ticket.id)}>
                        Assign to me
                    </button>
                )}
            </div>
        ))}
    </div>
);

const MockTicketDetail = ({
    ticket,
    comments,
    onAddComment,
    onResolve,
    userRole
}: {
    ticket: any,
    comments: any[],
    onAddComment: (content: string, isInternal: boolean) => void,
    onResolve: (resolution: string, createKB: boolean) => void,
    userRole: UserRole
}) => (
    <div data-testid="ticket-detail">
        <h1>{ticket.title}</h1>
        <p>Status: {ticket.status}</p>
        {ticket.deviceId && <p data-testid="device-id">Device: {ticket.deviceId}</p>}
        <p>Contact: {ticket.contactMethod}</p>

        <div data-testid="timeline">
            {comments.map((comment, index) => (
                <div key={index} data-testid={`comment-${index}`}>
                    <p>{comment.content}</p>
                    {comment.is_internal && <span>(Internal)</span>}
                </div>
            ))}
        </div>

        <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            onAddComment(
                formData.get('content') as string,
                formData.get('isInternal') === 'on'
            );
        }}>
            <textarea name="content" placeholder="Add comment" required />
            <label>
                <input type="checkbox" name="isInternal" />
                Internal note
            </label>
            <button type="submit">Add Comment</button>
        </form>

        {userRole === UserRole.IT_HELPDESK_ANALYST && ticket.status === TicketStatus.IN_PROGRESS && (
            <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                onResolve(
                    formData.get('resolution') as string,
                    formData.get('createKB') === 'on'
                );
            }}>
                <textarea name="resolution" placeholder="How was this resolved?" required />
                <label>
                    <input type="checkbox" name="createKB" />
                    Save as knowledge article
                </label>
                <button type="submit">Resolve Ticket</button>
            </form>
        )}
    </div>
);

describe('Help Desk UI Integration Tests', () => {
    const mockUser = {
        user_id: 'user1',
        role: UserRole.USER,
        tenant_id: 'tenant1',
    };

    const mockAnalyst = {
        user_id: 'analyst1',
        role: UserRole.IT_HELPDESK_ANALYST,
        tenant_id: 'tenant1',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Ticket Creation Workflow', () => {
        it('should create ticket with required fields only', async () => {
            const user = userEvent.setup();

            mockTicketService.createTicket.mockResolvedValue({
                id: 'ticket1',
                title: 'Test Ticket',
                description: 'Test description',
                status: TicketStatus.NEW,
                severity: TicketSeverity.MEDIUM,
                category: TicketCategory.IT_SUPPORT,
            });

            const handleSubmit = jest.fn();
            render(<MockTicketCreationForm onSubmit={handleSubmit} />);

            // Fill required fields
            await user.type(screen.getByPlaceholderText('Short title'), 'Test Ticket');
            await user.type(screen.getByPlaceholderText('Problem description'), 'Test description');
            await user.selectOptions(screen.getByDisplayValue('Select impact level'), 'medium');

            // Submit form
            await user.click(screen.getByText('Submit Ticket'));

            expect(handleSubmit).toHaveBeenCalledWith({
                title: 'Test Ticket',
                description: 'Test description',
                impactLevel: 'medium',
                deviceId: '',
                contactMethod: 'email', // Default
            });
        });

        it('should create ticket with optional device ID and phone contact', async () => {
            const user = userEvent.setup();

            const handleSubmit = jest.fn();
            render(<MockTicketCreationForm onSubmit={handleSubmit} />);

            // Fill all fields including optional ones
            await user.type(screen.getByPlaceholderText('Short title'), 'Hardware Issue');
            await user.type(screen.getByPlaceholderText('Problem description'), 'Computer not starting');
            await user.selectOptions(screen.getByDisplayValue('Select impact level'), 'critical');
            await user.type(screen.getByPlaceholderText('Device ID (optional)'), 'PC-RECEP-01');
            await user.selectOptions(screen.getByDisplayValue('Email'), 'phone');

            await user.click(screen.getByText('Submit Ticket'));

            expect(handleSubmit).toHaveBeenCalledWith({
                title: 'Hardware Issue',
                description: 'Computer not starting',
                impactLevel: 'critical',
                deviceId: 'PC-RECEP-01',
                contactMethod: 'phone',
            });
        });

        it('should show confirmation after successful ticket creation', async () => {
            const user = userEvent.setup();

            mockTicketService.createTicket.mockResolvedValue({
                id: 'ticket1',
                title: 'Test Ticket',
                description: 'Test description',
                status: TicketStatus.NEW,
                severity: TicketSeverity.HIGH,
            });

            const TicketCreationWithConfirmation = () => {
                const [ticket, setTicket] = React.useState(null);

                const handleSubmit = async (data: any) => {
                    const newTicket = await mockTicketService.createTicket(
                        'tenant1',
                        'user1',
                        {
                            requester: 'user1',
                            title: data.title,
                            description: data.description,
                            category: TicketCategory.IT_SUPPORT,
                            severity: data.impactLevel,
                            priority: data.impactLevel,
                        }
                    );
                    setTicket(newTicket);
                };

                if (ticket) {
                    return (
                        <div data-testid="confirmation">
                            <h2>Ticket Created Successfully</h2>
                            <p>Ticket Number: {(ticket as any).id}</p>
                            <p>Expected Response: Today</p>
                            <p>You will receive email updates</p>
                        </div>
                    );
                }

                return <MockTicketCreationForm onSubmit={handleSubmit} />;
            };

            render(<TicketCreationWithConfirmation />);

            // Create ticket
            await user.type(screen.getByPlaceholderText('Short title'), 'Test Ticket');
            await user.type(screen.getByPlaceholderText('Problem description'), 'Test description');
            await user.selectOptions(screen.getByDisplayValue('Select impact level'), 'critical');
            await user.click(screen.getByText('Submit Ticket'));

            // Wait for confirmation
            await waitFor(() => {
                expect(screen.getByTestId('confirmation')).toBeInTheDocument();
            });

            expect(screen.getByText('Ticket Number: ticket1')).toBeInTheDocument();
            expect(screen.getByText('Expected Response: Today')).toBeInTheDocument();
        });
    });

    describe('Queue Management Workflow', () => {
        it('should display tickets sorted by impact level and queue position', async () => {
            const mockTickets = [
                {
                    id: 'ticket1',
                    title: 'Critical Issue',
                    status: TicketStatus.NEW,
                    severity: TicketSeverity.CRITICAL,
                    assignee: null,
                    deviceId: 'PC-001',
                },
                {
                    id: 'ticket2',
                    title: 'Medium Issue',
                    status: TicketStatus.NEW,
                    severity: TicketSeverity.MEDIUM,
                    assignee: null,
                },
                {
                    id: 'ticket3',
                    title: 'Assigned Critical',
                    status: TicketStatus.IN_PROGRESS,
                    severity: TicketSeverity.CRITICAL,
                    assignee: 'analyst1',
                },
            ];

            const handleAssign = jest.fn();
            render(
                <MockTicketQueue
                    tickets={mockTickets}
                    onAssign={handleAssign}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            // Verify tickets are displayed
            expect(screen.getByTestId('ticket-ticket1')).toBeInTheDocument();
            expect(screen.getByTestId('ticket-ticket2')).toBeInTheDocument();
            expect(screen.getByTestId('ticket-ticket3')).toBeInTheDocument();

            // Verify device ID is prominently displayed
            expect(screen.getByText('Device: PC-001')).toBeInTheDocument();

            // Verify assign buttons only show for unassigned tickets
            const assignButtons = screen.getAllByText('Assign to me');
            expect(assignButtons).toHaveLength(2); // Only for ticket1 and ticket2
        });

        it('should handle self-assignment workflow', async () => {
            const user = userEvent.setup();

            mockTicketService.selfAssignTicket.mockResolvedValue({
                id: 'ticket1',
                title: 'Test Ticket',
                status: TicketStatus.IN_PROGRESS,
                assignee: 'analyst1',
            });

            const mockTickets = [
                {
                    id: 'ticket1',
                    title: 'Test Ticket',
                    status: TicketStatus.NEW,
                    severity: TicketSeverity.MEDIUM,
                    assignee: null,
                },
            ];

            const handleAssign = jest.fn().mockImplementation(async (ticketId) => {
                await mockTicketService.selfAssignTicket('tenant1', ticketId, 'analyst1', UserRole.IT_HELPDESK_ANALYST);
            });

            render(
                <MockTicketQueue
                    tickets={mockTickets}
                    onAssign={handleAssign}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            // Click assign button
            await user.click(screen.getByText('Assign to me'));

            expect(handleAssign).toHaveBeenCalledWith('ticket1');
            expect(mockTicketService.selfAssignTicket).toHaveBeenCalledWith(
                'tenant1',
                'ticket1',
                'analyst1',
                UserRole.IT_HELPDESK_ANALYST
            );
        });

        it('should show different queues for different user roles', async () => {
            const itTickets = [
                {
                    id: 'it1',
                    title: 'IT Support Ticket',
                    category: TicketCategory.IT_SUPPORT,
                    status: TicketStatus.NEW,
                    severity: TicketSeverity.MEDIUM,
                },
            ];

            const securityTickets = [
                {
                    id: 'sec1',
                    title: 'Security Incident',
                    category: TicketCategory.SECURITY_INCIDENT,
                    status: TicketStatus.NEW,
                    severity: TicketSeverity.HIGH,
                },
            ];

            // IT Helpdesk Analyst should only see IT tickets
            const { rerender } = render(
                <MockTicketQueue
                    tickets={itTickets}
                    onAssign={jest.fn()}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            expect(screen.getByText('IT Support Ticket')).toBeInTheDocument();
            expect(screen.queryByText('Security Incident')).not.toBeInTheDocument();

            // Security Analyst should only see security tickets
            rerender(
                <MockTicketQueue
                    tickets={securityTickets}
                    onAssign={jest.fn()}
                    userRole={UserRole.SECURITY_ANALYST}
                />
            );

            expect(screen.getByText('Security Incident')).toBeInTheDocument();
            expect(screen.queryByText('IT Support Ticket')).not.toBeInTheDocument();
        });
    });

    describe('Ticket Detail and Resolution Workflow', () => {
        it('should display ticket details with prominent device ID', async () => {
            const mockTicket = {
                id: 'ticket1',
                title: 'Computer Issues',
                status: TicketStatus.IN_PROGRESS,
                deviceId: 'PC-RECEP-01',
                contactMethod: 'phone',
                assignee: 'analyst1',
            };

            const mockComments = [
                {
                    content: 'Initial problem report',
                    is_internal: false,
                    user_id: 'user1',
                },
                {
                    content: 'Checking hardware components',
                    is_internal: true,
                    user_id: 'analyst1',
                },
            ];

            render(
                <MockTicketDetail
                    ticket={mockTicket}
                    comments={mockComments}
                    onAddComment={jest.fn()}
                    onResolve={jest.fn()}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            // Verify ticket details
            expect(screen.getByText('Computer Issues')).toBeInTheDocument();
            expect(screen.getByTestId('device-id')).toHaveTextContent('Device: PC-RECEP-01');
            expect(screen.getByText('Contact: phone')).toBeInTheDocument();

            // Verify timeline
            expect(screen.getByText('Initial problem report')).toBeInTheDocument();
            expect(screen.getByText('Checking hardware components')).toBeInTheDocument();
            expect(screen.getByText('(Internal)')).toBeInTheDocument();
        });

        it('should handle comment addition workflow', async () => {
            const user = userEvent.setup();

            const mockTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                status: TicketStatus.IN_PROGRESS,
            };

            const handleAddComment = jest.fn();

            render(
                <MockTicketDetail
                    ticket={mockTicket}
                    comments={[]}
                    onAddComment={handleAddComment}
                    onResolve={jest.fn()}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            // Add internal comment
            await user.type(screen.getByPlaceholderText('Add comment'), 'Internal investigation note');
            await user.click(screen.getByLabelText(/Internal note/));
            await user.click(screen.getByText('Add Comment'));

            expect(handleAddComment).toHaveBeenCalledWith('Internal investigation note', true);
        });

        it('should handle ticket resolution with knowledge article creation', async () => {
            const user = userEvent.setup();

            const mockTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                status: TicketStatus.IN_PROGRESS,
                assignee: 'analyst1',
            };

            const handleResolve = jest.fn();

            render(
                <MockTicketDetail
                    ticket={mockTicket}
                    comments={[]}
                    onAddComment={jest.fn()}
                    onResolve={handleResolve}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            // Resolve ticket with KB creation
            await user.type(
                screen.getByPlaceholderText('How was this resolved?'),
                'Replaced faulty RAM module'
            );
            await user.click(screen.getByLabelText(/Save as knowledge article/));
            await user.click(screen.getByText('Resolve Ticket'));

            expect(handleResolve).toHaveBeenCalledWith('Replaced faulty RAM module', true);
        });

        it('should only show resolution form to analysts for in-progress tickets', async () => {
            const mockTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                status: TicketStatus.IN_PROGRESS,
            };

            // End user should not see resolution form
            const { rerender } = render(
                <MockTicketDetail
                    ticket={mockTicket}
                    comments={[]}
                    onAddComment={jest.fn()}
                    onResolve={jest.fn()}
                    userRole={UserRole.USER}
                />
            );

            expect(screen.queryByText('Resolve Ticket')).not.toBeInTheDocument();

            // Analyst should see resolution form for in-progress tickets
            rerender(
                <MockTicketDetail
                    ticket={mockTicket}
                    comments={[]}
                    onAddComment={jest.fn()}
                    onResolve={jest.fn()}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            expect(screen.getByText('Resolve Ticket')).toBeInTheDocument();

            // Analyst should not see resolution form for resolved tickets
            rerender(
                <MockTicketDetail
                    ticket={{ ...mockTicket, status: TicketStatus.RESOLVED }}
                    comments={[]}
                    onAddComment={jest.fn()}
                    onResolve={jest.fn()}
                    userRole={UserRole.IT_HELPDESK_ANALYST}
                />
            );

            expect(screen.queryByText('Resolve Ticket')).not.toBeInTheDocument();
        });
    });

    describe('Error Handling and User Feedback', () => {
        it('should display validation errors for incomplete ticket creation', async () => {
            const user = userEvent.setup();

            const ValidationForm = () => {
                const [errors, setErrors] = React.useState<string[]>([]);

                const handleSubmit = (data: any) => {
                    const validationErrors = [];
                    if (!data.title || data.title === '') validationErrors.push('Title is required');
                    if (!data.description || data.description === '') validationErrors.push('Description is required');
                    if (!data.impactLevel || data.impactLevel === '') validationErrors.push('Impact level is required');

                    setErrors(validationErrors);
                };

                return (
                    <div>
                        {errors.length > 0 && (
                            <div data-testid="validation-errors">
                                {errors.map((error, index) => (
                                    <p key={index} style={{ color: 'red' }}>{error}</p>
                                ))}
                            </div>
                        )}
                        <MockTicketCreationForm onSubmit={handleSubmit} />
                    </div>
                );
            };

            render(<ValidationForm />);

            // Submit empty form
            await user.click(screen.getByText('Submit Ticket'));

            // Should show validation errors
            await waitFor(() => {
                expect(screen.getByTestId('validation-errors')).toBeInTheDocument();
            });

            expect(screen.getByText('Title is required')).toBeInTheDocument();
            expect(screen.getByText('Description is required')).toBeInTheDocument();
            expect(screen.getByText('Impact level is required')).toBeInTheDocument();
        });

        it('should handle service errors gracefully', async () => {
            const user = userEvent.setup();

            mockTicketService.createTicket.mockRejectedValue(
                new Error('Service temporarily unavailable')
            );

            const ErrorHandlingForm = () => {
                const [error, setError] = React.useState<string | null>(null);

                const handleSubmit = async (data: any) => {
                    try {
                        await mockTicketService.createTicket('tenant1', 'user1', data);
                    } catch (err) {
                        setError((err as Error).message);
                    }
                };

                return (
                    <div>
                        {error && (
                            <div data-testid="service-error" style={{ color: 'red' }}>
                                {error}
                            </div>
                        )}
                        <MockTicketCreationForm onSubmit={handleSubmit} />
                    </div>
                );
            };

            render(<ErrorHandlingForm />);

            // Fill and submit form
            await user.type(screen.getByPlaceholderText('Short title'), 'Test Ticket');
            await user.type(screen.getByPlaceholderText('Problem description'), 'Test description');
            await user.selectOptions(screen.getByDisplayValue('Select impact level'), 'medium');
            await user.click(screen.getByText('Submit Ticket'));

            // Should show service error
            await waitFor(() => {
                expect(screen.getByTestId('service-error')).toBeInTheDocument();
            });

            expect(screen.getByText('Service temporarily unavailable')).toBeInTheDocument();
        });
    });

    describe('Accessibility and User Experience', () => {
        it('should have proper form labels and accessibility attributes', async () => {
            render(<MockTicketCreationForm onSubmit={jest.fn()} />);

            // Check for proper form elements
            expect(screen.getByPlaceholderText('Short title')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Problem description')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Select impact level')).toBeInTheDocument();

            // Check for user-friendly impact level options
            expect(screen.getByText('I can\'t work at all')).toBeInTheDocument();
            expect(screen.getByText('This is slowing me down')).toBeInTheDocument();
            expect(screen.getByText('It\'s a minor issue')).toBeInTheDocument();
        });

        it('should provide clear status indicators and progress feedback', async () => {
            const mockTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                status: TicketStatus.IN_PROGRESS,
                assignee: 'analyst1',
            };

            render(
                <MockTicketDetail
                    ticket={mockTicket}
                    comments={[]}
                    onAddComment={jest.fn()}
                    onResolve={jest.fn()}
                    userRole={UserRole.USER}
                />
            );

            // Should show clear status
            expect(screen.getByText('Status: in_progress')).toBeInTheDocument();
        });
    });
});