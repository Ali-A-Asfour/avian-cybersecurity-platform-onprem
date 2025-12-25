import { TicketFieldAccessControl } from '../ticket-field-access.middleware';
import { UserRole } from '@/types';

describe('TicketFieldAccessControl', () => {
  const mockUserId = 'user-123';
  const mockCreatorId = 'creator-456';
  const mockTenantId = 'tenant-789';

  describe('canEditField', () => {
    it('should allow ticket creator to edit title and description', () => {
      expect(TicketFieldAccessControl.canEditField('title', mockCreatorId, mockCreatorId, UserRole.USER)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('description', mockCreatorId, mockCreatorId, UserRole.USER)).toBe(true);
    });

    it('should deny non-creator from editing title and description', () => {
      expect(TicketFieldAccessControl.canEditField('title', mockUserId, mockCreatorId, UserRole.SECURITY_ANALYST)).toBe(false);
      expect(TicketFieldAccessControl.canEditField('description', mockUserId, mockCreatorId, UserRole.IT_HELPDESK_ANALYST)).toBe(false);
    });

    it('should allow Security Analysts to edit other fields', () => {
      expect(TicketFieldAccessControl.canEditField('assignee', mockUserId, mockCreatorId, UserRole.SECURITY_ANALYST)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('severity', mockUserId, mockCreatorId, UserRole.SECURITY_ANALYST)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('status', mockUserId, mockCreatorId, UserRole.SECURITY_ANALYST)).toBe(true);
    });

    it('should allow IT Helpdesk Analysts to edit other fields', () => {
      expect(TicketFieldAccessControl.canEditField('assignee', mockUserId, mockCreatorId, UserRole.IT_HELPDESK_ANALYST)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('priority', mockUserId, mockCreatorId, UserRole.IT_HELPDESK_ANALYST)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('tags', mockUserId, mockCreatorId, UserRole.IT_HELPDESK_ANALYST)).toBe(true);
    });

    it('should allow Super Admin to edit all fields', () => {
      expect(TicketFieldAccessControl.canEditField('title', mockUserId, mockCreatorId, UserRole.SUPER_ADMIN)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('description', mockUserId, mockCreatorId, UserRole.SUPER_ADMIN)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('assignee', mockUserId, mockCreatorId, UserRole.SUPER_ADMIN)).toBe(true);
    });

    it('should allow Tenant Admin to edit all fields', () => {
      expect(TicketFieldAccessControl.canEditField('title', mockUserId, mockCreatorId, UserRole.TENANT_ADMIN)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('description', mockUserId, mockCreatorId, UserRole.TENANT_ADMIN)).toBe(true);
      expect(TicketFieldAccessControl.canEditField('status', mockUserId, mockCreatorId, UserRole.TENANT_ADMIN)).toBe(true);
    });

    it('should deny regular users from editing any fields (except if they are creator)', () => {
      expect(TicketFieldAccessControl.canEditField('assignee', mockUserId, mockCreatorId, UserRole.USER)).toBe(false);
      expect(TicketFieldAccessControl.canEditField('severity', mockUserId, mockCreatorId, UserRole.USER)).toBe(false);
      expect(TicketFieldAccessControl.canEditField('status', mockUserId, mockCreatorId, UserRole.USER)).toBe(false);
    });
  });

  describe('getEditableFields', () => {
    it('should return correct editable fields for ticket creator', () => {
      const editableFields = TicketFieldAccessControl.getEditableFields(
        mockCreatorId, 
        mockCreatorId, 
        UserRole.SECURITY_ANALYST
      );
      
      expect(editableFields).toContain('title');
      expect(editableFields).toContain('description');
      expect(editableFields).toContain('assignee');
      expect(editableFields).toContain('severity');
    });

    it('should return correct editable fields for non-creator Security Analyst', () => {
      const editableFields = TicketFieldAccessControl.getEditableFields(
        mockUserId, 
        mockCreatorId, 
        UserRole.SECURITY_ANALYST
      );
      
      expect(editableFields).not.toContain('title');
      expect(editableFields).not.toContain('description');
      expect(editableFields).toContain('assignee');
      expect(editableFields).toContain('severity');
    });

    it('should return no editable fields for regular user who is not creator', () => {
      const editableFields = TicketFieldAccessControl.getEditableFields(
        mockUserId, 
        mockCreatorId, 
        UserRole.USER
      );
      
      expect(editableFields).toHaveLength(0);
    });
  });

  describe('isTicketCreator', () => {
    it('should correctly identify ticket creator', () => {
      expect(TicketFieldAccessControl.isTicketCreator(mockCreatorId, mockCreatorId)).toBe(true);
      expect(TicketFieldAccessControl.isTicketCreator(mockUserId, mockCreatorId)).toBe(false);
    });
  });

  describe('getFieldPermissions', () => {
    it('should return correct permissions for ticket creator', () => {
      const permissions = TicketFieldAccessControl.getFieldPermissions(
        mockCreatorId, 
        mockCreatorId, 
        UserRole.SECURITY_ANALYST
      );
      
      expect(permissions.title.canEdit).toBe(true);
      expect(permissions.description.canEdit).toBe(true);
      expect(permissions.assignee.canEdit).toBe(true);
    });

    it('should return correct permissions with reasons for non-creator', () => {
      const permissions = TicketFieldAccessControl.getFieldPermissions(
        mockUserId, 
        mockCreatorId, 
        UserRole.SECURITY_ANALYST
      );
      
      expect(permissions.title.canEdit).toBe(false);
      expect(permissions.title.reason).toContain('Only the ticket creator');
      expect(permissions.description.canEdit).toBe(false);
      expect(permissions.description.reason).toContain('Only the ticket creator');
      expect(permissions.assignee.canEdit).toBe(true);
    });
  });
});