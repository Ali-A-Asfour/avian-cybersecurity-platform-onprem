--
-- PostgreSQL database dump
--

\restrict yZmBmd2Jz04m87nT8rxRtzgZtxbhiFUcF8CdmCt0bq95Vy0qjSOo3rLXjTYlQGs

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: alert_category; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.alert_category AS ENUM (
    'malware',
    'phishing',
    'intrusion',
    'data_breach',
    'policy_violation',
    'anomaly',
    'other'
);


ALTER TYPE public.alert_category OWNER TO avian;

--
-- Name: alert_severity; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.alert_severity AS ENUM (
    'info',
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public.alert_severity OWNER TO avian;

--
-- Name: alert_source_system; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.alert_source_system AS ENUM (
    'edr',
    'firewall',
    'email'
);


ALTER TYPE public.alert_source_system OWNER TO avian;

--
-- Name: alert_status; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.alert_status AS ENUM (
    'open',
    'investigating',
    'resolved',
    'false_positive',
    'assigned',
    'escalated',
    'closed_benign',
    'closed_false_positive'
);


ALTER TYPE public.alert_status OWNER TO avian;

--
-- Name: compliance_status; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.compliance_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'non_compliant'
);


ALTER TYPE public.compliance_status OWNER TO avian;

--
-- Name: incident_status; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.incident_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'dismissed'
);


ALTER TYPE public.incident_status OWNER TO avian;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.notification_type AS ENUM (
    'info',
    'warning',
    'error',
    'success'
);


ALTER TYPE public.notification_type OWNER TO avian;

--
-- Name: playbook_status; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.playbook_status AS ENUM (
    'active',
    'draft',
    'deprecated'
);


ALTER TYPE public.playbook_status OWNER TO avian;

--
-- Name: ticket_category; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.ticket_category AS ENUM (
    'security_incident',
    'vulnerability',
    'malware_detection',
    'phishing_attempt',
    'data_breach',
    'policy_violation',
    'compliance',
    'it_support',
    'hardware_issue',
    'software_issue',
    'network_issue',
    'access_request',
    'account_setup',
    'general_request',
    'other'
);


ALTER TYPE public.ticket_category OWNER TO avian;

--
-- Name: ticket_priority; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.ticket_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.ticket_priority OWNER TO avian;

--
-- Name: ticket_severity; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.ticket_severity AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public.ticket_severity OWNER TO avian;

--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.ticket_status AS ENUM (
    'new',
    'in_progress',
    'awaiting_response',
    'resolved',
    'closed'
);


ALTER TYPE public.ticket_status OWNER TO avian;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: avian
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'tenant_admin',
    'analyst',
    'user',
    'security_analyst',
    'it_helpdesk_analyst'
);


ALTER TYPE public.user_role OWNER TO avian;

--
-- Name: add_password_to_history(uuid, character varying); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.add_password_to_history(p_user_id uuid, p_password_hash character varying) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    history_id uuid;
BEGIN
    -- Insert the new password into history
    INSERT INTO password_history (user_id, password_hash)
    VALUES (p_user_id, p_password_hash)
    RETURNING id INTO history_id;
    
    RETURN history_id;
END;
$$;


ALTER FUNCTION public.add_password_to_history(p_user_id uuid, p_password_hash character varying) OWNER TO avian;

--
-- Name: FUNCTION add_password_to_history(p_user_id uuid, p_password_hash character varying); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.add_password_to_history(p_user_id uuid, p_password_hash character varying) IS 'Add a password hash to the user''s password history';


--
-- Name: check_failed_login_attempts(); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.check_failed_login_attempts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Lock account if failed attempts exceed threshold (5 attempts)
    IF NEW.failed_login_attempts >= 5 THEN
        NEW.account_locked = true;
    END IF;
    
    -- Update last failed login timestamp
    IF NEW.failed_login_attempts > OLD.failed_login_attempts THEN
        NEW.last_failed_login = NOW();
    END IF;
    
    -- Reset failed attempts on successful login (when last_login is updated)
    IF NEW.last_login IS DISTINCT FROM OLD.last_login AND NEW.last_login IS NOT NULL THEN
        NEW.failed_login_attempts = 0;
        NEW.last_failed_login = NULL;
        NEW.account_locked = false;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_failed_login_attempts() OWNER TO avian;

--
-- Name: cleanup_all_password_history(integer); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.cleanup_all_password_history(p_keep_count integer DEFAULT 10) RETURNS TABLE(user_id uuid, deleted_count integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        cleanup_old_password_history(u.id, p_keep_count)
    FROM users u
    WHERE EXISTS (
        SELECT 1 FROM password_history ph WHERE ph.user_id = u.id
    );
END;
$$;


ALTER FUNCTION public.cleanup_all_password_history(p_keep_count integer) OWNER TO avian;

--
-- Name: FUNCTION cleanup_all_password_history(p_keep_count integer); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.cleanup_all_password_history(p_keep_count integer) IS 'Clean up old password history for all users (maintenance function)';


--
-- Name: cleanup_old_audit_logs(integer); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.cleanup_old_audit_logs(retention_days integer DEFAULT 365) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_audit_logs(retention_days integer) OWNER TO avian;

--
-- Name: FUNCTION cleanup_old_audit_logs(retention_days integer); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.cleanup_old_audit_logs(retention_days integer) IS 'Cleanup audit logs older than specified days (default: 365 days)';


--
-- Name: cleanup_old_password_history(uuid, integer); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.cleanup_old_password_history(p_user_id uuid, p_keep_count integer DEFAULT 10) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Delete password history entries beyond the keep count
    WITH ranked_passwords AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM password_history
        WHERE user_id = p_user_id
    )
    DELETE FROM password_history
    WHERE id IN (
        SELECT id FROM ranked_passwords WHERE rn > p_keep_count
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_old_password_history(p_user_id uuid, p_keep_count integer) OWNER TO avian;

--
-- Name: FUNCTION cleanup_old_password_history(p_user_id uuid, p_keep_count integer); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.cleanup_old_password_history(p_user_id uuid, p_keep_count integer) IS 'Remove old password history entries, keeping only the most recent N passwords (default: 10)';


--
-- Name: enforce_password_history_policy(uuid, character varying, integer); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.enforce_password_history_policy(p_user_id uuid, p_new_password_hash character varying, p_history_limit integer DEFAULT 5) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_is_reused boolean;
BEGIN
    -- Check if the password was recently used
    v_is_reused := is_password_recently_used(p_user_id, p_new_password_hash, p_history_limit);
    
    IF v_is_reused THEN
        RAISE EXCEPTION 'Password has been used recently. Please choose a different password.'
            USING ERRCODE = 'check_violation',
                  HINT = 'You cannot reuse your last ' || p_history_limit || ' passwords';
    END IF;
    
    RETURN true;
END;
$$;


ALTER FUNCTION public.enforce_password_history_policy(p_user_id uuid, p_new_password_hash character varying, p_history_limit integer) OWNER TO avian;

--
-- Name: FUNCTION enforce_password_history_policy(p_user_id uuid, p_new_password_hash character varying, p_history_limit integer); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.enforce_password_history_policy(p_user_id uuid, p_new_password_hash character varying, p_history_limit integer) IS 'Enforce password history policy by raising an exception if password was recently used';


--
-- Name: get_user_password_history(uuid, integer); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.get_user_password_history(p_user_id uuid, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, created_at timestamp without time zone, days_ago numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ph.id,
        ph.created_at,
        ROUND(EXTRACT(EPOCH FROM (NOW() - ph.created_at)) / 86400, 1) as days_ago
    FROM password_history ph
    WHERE ph.user_id = p_user_id
    ORDER BY ph.created_at DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION public.get_user_password_history(p_user_id uuid, p_limit integer) OWNER TO avian;

--
-- Name: FUNCTION get_user_password_history(p_user_id uuid, p_limit integer); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.get_user_password_history(p_user_id uuid, p_limit integer) IS 'Retrieve password change history for a user (hashes not included for security)';


--
-- Name: is_password_recently_used(uuid, character varying, integer); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.is_password_recently_used(p_user_id uuid, p_password_hash character varying, p_history_limit integer DEFAULT 5) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_match_count integer;
BEGIN
    -- Check if the password hash exists in the user's recent password history
    SELECT COUNT(*)
    INTO v_match_count
    FROM (
        SELECT password_hash
        FROM password_history
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT p_history_limit
    ) recent_passwords
    WHERE password_hash = p_password_hash;
    
    RETURN v_match_count > 0;
END;
$$;


ALTER FUNCTION public.is_password_recently_used(p_user_id uuid, p_password_hash character varying, p_history_limit integer) OWNER TO avian;

--
-- Name: FUNCTION is_password_recently_used(p_user_id uuid, p_password_hash character varying, p_history_limit integer); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.is_password_recently_used(p_user_id uuid, p_password_hash character varying, p_history_limit integer) IS 'Check if a password hash exists in the user''s recent password history (default: last 5 passwords)';


--
-- Name: sync_playbook_classification_status(); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.sync_playbook_classification_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update all classification links when playbook status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE playbook_classification_links 
        SET playbook_status = NEW.status 
        WHERE playbook_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_playbook_classification_status() OWNER TO avian;

--
-- Name: trigger_add_password_to_history(); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.trigger_add_password_to_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only add to history if password_hash actually changed
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash AND NEW.password_hash IS NOT NULL THEN
        -- Add the new password to history
        PERFORM add_password_to_history(NEW.id, NEW.password_hash);
        
        -- Clean up old history entries (keep last 10)
        PERFORM cleanup_old_password_history(NEW.id, 10);
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_add_password_to_history() OWNER TO avian;

--
-- Name: FUNCTION trigger_add_password_to_history(); Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON FUNCTION public.trigger_add_password_to_history() IS 'Automatically add password to history when user password changes';


--
-- Name: update_investigation_playbooks_updated_at(); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.update_investigation_playbooks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_investigation_playbooks_updated_at() OWNER TO avian;

--
-- Name: update_security_alerts_updated_at(); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.update_security_alerts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_security_alerts_updated_at() OWNER TO avian;

--
-- Name: update_security_incidents_updated_at(); Type: FUNCTION; Schema: public; Owner: avian
--

CREATE FUNCTION public.update_security_incidents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_security_incidents_updated_at() OWNER TO avian;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source character varying(255) NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    severity public.alert_severity NOT NULL,
    category public.alert_category NOT NULL,
    status public.alert_status DEFAULT 'open'::public.alert_status NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.alerts OWNER TO avian;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    user_id uuid,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    session_id uuid,
    risk_score integer DEFAULT 0
);


ALTER TABLE public.audit_logs OWNER TO avian;

--
-- Name: COLUMN audit_logs.session_id; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.audit_logs.session_id IS 'Session ID associated with the audit event';


--
-- Name: COLUMN audit_logs.risk_score; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.audit_logs.risk_score IS 'Risk score (0-100) calculated for the event';


--
-- Name: auth_audit_logs; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.auth_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email character varying(255),
    action character varying(100) NOT NULL,
    result character varying(50) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT auth_audit_logs_action_check CHECK (((action)::text = ANY ((ARRAY['login'::character varying, 'logout'::character varying, 'register'::character varying, 'password_change'::character varying, 'password_reset_request'::character varying, 'password_reset_complete'::character varying, 'email_verification'::character varying, 'mfa_enable'::character varying, 'mfa_disable'::character varying, 'mfa_verify'::character varying, 'session_create'::character varying, 'session_revoke'::character varying, 'account_lock'::character varying, 'account_unlock'::character varying, 'role_change'::character varying, 'permission_change'::character varying, 'profile_update'::character varying, 'api_key_create'::character varying, 'api_key_revoke'::character varying])::text[]))),
    CONSTRAINT auth_audit_logs_email_required CHECK (((email IS NOT NULL) AND ((email)::text <> ''::text))),
    CONSTRAINT auth_audit_logs_result_check CHECK (((result)::text = ANY ((ARRAY['success'::character varying, 'failure'::character varying, 'error'::character varying, 'blocked'::character varying, 'pending'::character varying])::text[])))
);


ALTER TABLE public.auth_audit_logs OWNER TO avian;

--
-- Name: TABLE auth_audit_logs; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON TABLE public.auth_audit_logs IS 'Immutable audit log of all authentication and authorization events for security monitoring and compliance';


--
-- Name: COLUMN auth_audit_logs.user_id; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.user_id IS 'Reference to user who performed the action (NULL for failed login attempts with invalid email)';


--
-- Name: COLUMN auth_audit_logs.email; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.email IS 'Email address used in the action (stored separately to track failed attempts with non-existent emails)';


--
-- Name: COLUMN auth_audit_logs.action; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.action IS 'Type of action performed (e.g., login, logout, password_change, mfa_enable, permission_change)';


--
-- Name: COLUMN auth_audit_logs.result; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.result IS 'Result of the action (e.g., success, failure, error, blocked)';


--
-- Name: COLUMN auth_audit_logs.ip_address; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.ip_address IS 'IP address from which the action was performed';


--
-- Name: COLUMN auth_audit_logs.user_agent; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.user_agent IS 'Browser/client user agent string';


--
-- Name: COLUMN auth_audit_logs.metadata; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.metadata IS 'Additional context data in JSON format (e.g., failure reason, changed fields, session info)';


--
-- Name: COLUMN auth_audit_logs.created_at; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.auth_audit_logs.created_at IS 'Timestamp when the event occurred (immutable)';


--
-- Name: compliance_controls; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.compliance_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    framework_id uuid NOT NULL,
    control_id character varying(100) NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    status public.compliance_status DEFAULT 'not_started'::public.compliance_status NOT NULL,
    last_reviewed timestamp without time zone,
    next_review_date timestamp without time zone,
    assigned_to uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.compliance_controls OWNER TO avian;

--
-- Name: compliance_evidence; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.compliance_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    control_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_path text NOT NULL,
    description text,
    uploaded_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.compliance_evidence OWNER TO avian;

--
-- Name: compliance_frameworks; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.compliance_frameworks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.compliance_frameworks OWNER TO avian;

--
-- Name: failed_login_attempts; Type: VIEW; Schema: public; Owner: avian
--

CREATE VIEW public.failed_login_attempts AS
 SELECT email,
    ip_address,
    count(*) AS attempt_count,
    max(created_at) AS last_attempt,
    min(created_at) AS first_attempt,
    array_agg(DISTINCT user_agent) AS user_agents,
    jsonb_agg(jsonb_build_object('timestamp', created_at, 'metadata', metadata) ORDER BY created_at DESC) AS attempts
   FROM public.auth_audit_logs
  WHERE (((action)::text = 'login'::text) AND ((result)::text = ANY ((ARRAY['failure'::character varying, 'blocked'::character varying])::text[])) AND (created_at > (now() - '24:00:00'::interval)))
  GROUP BY email, ip_address
 HAVING (count(*) >= 3)
  ORDER BY (count(*)) DESC, (max(created_at)) DESC;


ALTER VIEW public.failed_login_attempts OWNER TO avian;

--
-- Name: VIEW failed_login_attempts; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON VIEW public.failed_login_attempts IS 'Aggregated view of failed login attempts in the last 24 hours for security monitoring';


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    requester character varying(255) NOT NULL,
    assignee character varying(255),
    title character varying(500) NOT NULL,
    description text NOT NULL,
    severity public.ticket_severity NOT NULL,
    priority public.ticket_priority NOT NULL,
    status public.ticket_status DEFAULT 'new'::public.ticket_status NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    sla_deadline timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    category public.ticket_category NOT NULL
);


ALTER TABLE public.tickets OWNER TO avian;

--
-- Name: COLUMN tickets.category; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.tickets.category IS 'Ticket category with role-based access control';


--
-- Name: general_tickets; Type: VIEW; Schema: public; Owner: avian
--

CREATE VIEW public.general_tickets AS
 SELECT id,
    tenant_id,
    requester,
    assignee,
    title,
    description,
    severity,
    priority,
    status,
    tags,
    sla_deadline,
    created_at,
    updated_at,
    category
   FROM public.tickets
  WHERE (category = ANY (ARRAY['general_request'::public.ticket_category, 'other'::public.ticket_category]));


ALTER VIEW public.general_tickets OWNER TO avian;

--
-- Name: investigation_playbooks; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.investigation_playbooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    version character varying(50) NOT NULL,
    status public.playbook_status DEFAULT 'draft'::public.playbook_status NOT NULL,
    purpose text NOT NULL,
    initial_validation_steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_investigation_steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    containment_checks jsonb DEFAULT '[]'::jsonb NOT NULL,
    decision_guidance jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.investigation_playbooks OWNER TO avian;

--
-- Name: TABLE investigation_playbooks; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON TABLE public.investigation_playbooks IS 'Investigation playbooks with version control and role-based access';


--
-- Name: COLUMN investigation_playbooks.decision_guidance; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.investigation_playbooks.decision_guidance IS 'JSON guidance for escalation vs resolution decisions';


--
-- Name: it_support_tickets; Type: VIEW; Schema: public; Owner: avian
--

CREATE VIEW public.it_support_tickets AS
 SELECT id,
    tenant_id,
    requester,
    assignee,
    title,
    description,
    severity,
    priority,
    status,
    tags,
    sla_deadline,
    created_at,
    updated_at,
    category
   FROM public.tickets
  WHERE (category = ANY (ARRAY['it_support'::public.ticket_category, 'hardware_issue'::public.ticket_category, 'software_issue'::public.ticket_category, 'network_issue'::public.ticket_category, 'access_request'::public.ticket_category, 'account_setup'::public.ticket_category]));


ALTER VIEW public.it_support_tickets OWNER TO avian;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    domain character varying(255) NOT NULL,
    logo_url text,
    theme_color character varying(7),
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenants OWNER TO avian;

--
-- Name: users; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_secret text,
    password_hash text NOT NULL,
    last_login timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    mfa_backup_codes jsonb DEFAULT '[]'::jsonb,
    mfa_setup_completed boolean DEFAULT false NOT NULL,
    account_locked boolean DEFAULT false NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    last_failed_login timestamp without time zone,
    locked_until timestamp without time zone,
    name character varying(255) GENERATED ALWAYS AS (
CASE
    WHEN ((first_name IS NOT NULL) AND (last_name IS NOT NULL)) THEN (((first_name)::text || ' '::text) || (last_name)::text)
    WHEN (first_name IS NOT NULL) THEN (first_name)::text
    WHEN (last_name IS NOT NULL) THEN (last_name)::text
    ELSE ''::text
END) STORED,
    email_verified boolean DEFAULT false,
    password_changed_at timestamp without time zone DEFAULT now(),
    password_expires_at timestamp without time zone,
    CONSTRAINT users_email_format_check CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT users_password_hash_not_null_when_active CHECK (((NOT is_active) OR (password_hash IS NOT NULL)))
);


ALTER TABLE public.users OWNER TO avian;

--
-- Name: COLUMN users.mfa_backup_codes; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.users.mfa_backup_codes IS 'Array of hashed backup codes for MFA recovery';


--
-- Name: COLUMN users.mfa_setup_completed; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.users.mfa_setup_completed IS 'Whether user has completed mandatory MFA setup';


--
-- Name: COLUMN users.account_locked; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.users.account_locked IS 'Whether account is locked due to security events';


--
-- Name: COLUMN users.failed_login_attempts; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.users.failed_login_attempts IS 'Number of consecutive failed login attempts';


--
-- Name: COLUMN users.last_failed_login; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.users.last_failed_login IS 'Timestamp of last failed login attempt';


--
-- Name: COLUMN users.locked_until; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.users.locked_until IS 'Timestamp until which the account is locked (NULL = not locked)';


--
-- Name: COLUMN users.name; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.users.name IS 'Full name computed from first_name and last_name for auth compatibility';


--
-- Name: locked_accounts; Type: VIEW; Schema: public; Owner: avian
--

CREATE VIEW public.locked_accounts AS
 SELECT u.id,
    u.email,
    u.name,
    u.first_name,
    u.last_name,
    u.tenant_id,
    u.failed_login_attempts,
    u.last_failed_login,
    u.locked_until,
    u.account_locked,
    t.name AS tenant_name,
        CASE
            WHEN (u.locked_until > now()) THEN true
            ELSE false
        END AS is_currently_locked,
        CASE
            WHEN (u.locked_until > now()) THEN ((u.locked_until)::timestamp with time zone - now())
            ELSE '00:00:00'::interval
        END AS time_until_unlock
   FROM (public.users u
     LEFT JOIN public.tenants t ON ((u.tenant_id = t.id)))
  WHERE ((u.locked_until IS NOT NULL) OR (u.account_locked = true))
  ORDER BY u.locked_until DESC NULLS LAST;


ALTER VIEW public.locked_accounts OWNER TO avian;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type public.notification_type DEFAULT 'info'::public.notification_type NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone
);


ALTER TABLE public.notifications OWNER TO avian;

--
-- Name: password_history; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.password_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT password_history_hash_not_empty CHECK (((password_hash IS NOT NULL) AND ((password_hash)::text <> ''::text)))
);


ALTER TABLE public.password_history OWNER TO avian;

--
-- Name: TABLE password_history; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON TABLE public.password_history IS 'Historical record of user passwords to prevent reuse of recent passwords';


--
-- Name: COLUMN password_history.user_id; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.password_history.user_id IS 'Reference to the user who owns this password history entry';


--
-- Name: COLUMN password_history.password_hash; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.password_history.password_hash IS 'Bcrypt hash of the historical password';


--
-- Name: COLUMN password_history.created_at; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.password_history.created_at IS 'Timestamp when this password was set';


--
-- Name: password_history_stats; Type: VIEW; Schema: public; Owner: avian
--

CREATE VIEW public.password_history_stats AS
 SELECT u.id AS user_id,
    u.email,
    u.name,
    count(ph.id) AS total_password_changes,
    min(ph.created_at) AS first_password_change,
    max(ph.created_at) AS last_password_change,
        CASE
            WHEN (max(ph.created_at) IS NOT NULL) THEN (EXTRACT(epoch FROM (now() - (max(ph.created_at))::timestamp with time zone)) / (86400)::numeric)
            ELSE NULL::numeric
        END AS days_since_last_change
   FROM (public.users u
     LEFT JOIN public.password_history ph ON ((u.id = ph.user_id)))
  GROUP BY u.id, u.email, u.name;


ALTER VIEW public.password_history_stats OWNER TO avian;

--
-- Name: VIEW password_history_stats; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON VIEW public.password_history_stats IS 'Statistics about password change history for each user';


--
-- Name: playbook_classification_links; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.playbook_classification_links (
    playbook_id uuid NOT NULL,
    classification character varying(100) NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    playbook_status public.playbook_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.playbook_classification_links OWNER TO avian;

--
-- Name: TABLE playbook_classification_links; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON TABLE public.playbook_classification_links IS 'Junction table linking playbooks to alert classifications with primary/secondary relationships';


--
-- Name: COLUMN playbook_classification_links.playbook_status; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.playbook_classification_links.playbook_status IS 'Denormalized status from investigation_playbooks for constraint enforcement';


--
-- Name: security_alerts; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.security_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_system public.alert_source_system NOT NULL,
    source_id character varying(255) NOT NULL,
    alert_type character varying(100) NOT NULL,
    classification character varying(100) NOT NULL,
    severity public.alert_severity NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    seen_count integer DEFAULT 1 NOT NULL,
    first_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp without time zone DEFAULT now() NOT NULL,
    defender_incident_id character varying(255),
    defender_alert_id character varying(255),
    defender_severity character varying(50),
    threat_name character varying(255),
    affected_device character varying(255),
    affected_user character varying(255),
    status public.alert_status DEFAULT 'open'::public.alert_status NOT NULL,
    assigned_to uuid,
    assigned_at timestamp without time zone,
    detected_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_alerts_assignment_consistency CHECK ((((status = 'open'::public.alert_status) AND (assigned_to IS NULL) AND (assigned_at IS NULL)) OR ((status = ANY (ARRAY['assigned'::public.alert_status, 'investigating'::public.alert_status, 'escalated'::public.alert_status, 'closed_benign'::public.alert_status, 'closed_false_positive'::public.alert_status])) AND (assigned_to IS NOT NULL) AND (assigned_at IS NOT NULL)))),
    CONSTRAINT security_alerts_seen_count_positive CHECK ((seen_count >= 1))
);


ALTER TABLE public.security_alerts OWNER TO avian;

--
-- Name: TABLE security_alerts; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON TABLE public.security_alerts IS 'Security alerts from various sources (EDR, Firewall, Email) with tenant isolation and deduplication intelligence';


--
-- Name: COLUMN security_alerts.metadata; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_alerts.metadata IS 'JSON metadata from source system';


--
-- Name: COLUMN security_alerts.seen_count; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_alerts.seen_count IS 'Number of times this alert pattern was detected (deduplication intelligence)';


--
-- Name: COLUMN security_alerts.first_seen_at; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_alerts.first_seen_at IS 'When this alert pattern was first detected';


--
-- Name: COLUMN security_alerts.last_seen_at; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_alerts.last_seen_at IS 'When this alert pattern was most recently detected';


--
-- Name: security_events; Type: VIEW; Schema: public; Owner: avian
--

CREATE VIEW public.security_events AS
 SELECT al.id,
    al.tenant_id,
    al.user_id,
    al.action,
    al.resource_type,
    al.resource_id,
    al.details,
    al.ip_address,
    al.user_agent,
    al.session_id,
    al.risk_score,
    al.created_at,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.account_locked,
    u.failed_login_attempts,
    t.name AS tenant_name
   FROM ((public.audit_logs al
     LEFT JOIN public.users u ON ((al.user_id = u.id)))
     LEFT JOIN public.tenants t ON ((al.tenant_id = t.id)))
  WHERE (((al.action)::text ~~ 'auth.%'::text) OR ((al.action)::text ~~ 'security.%'::text))
  ORDER BY al.created_at DESC;


ALTER VIEW public.security_events OWNER TO avian;

--
-- Name: VIEW security_events; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON VIEW public.security_events IS 'Security-relevant authentication events that may require investigation';


--
-- Name: security_incidents; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.security_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    severity public.alert_severity NOT NULL,
    status public.incident_status DEFAULT 'open'::public.incident_status NOT NULL,
    resolution_summary text,
    dismissal_justification text,
    sla_acknowledge_by timestamp without time zone NOT NULL,
    sla_investigate_by timestamp without time zone NOT NULL,
    sla_resolve_by timestamp without time zone NOT NULL,
    acknowledged_at timestamp without time zone,
    investigation_started_at timestamp without time zone,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_incidents_resolution_consistency CHECK ((((status = 'resolved'::public.incident_status) AND (resolution_summary IS NOT NULL) AND (dismissal_justification IS NULL)) OR ((status = 'dismissed'::public.incident_status) AND (dismissal_justification IS NOT NULL) AND (resolution_summary IS NULL)) OR ((status = ANY (ARRAY['open'::public.incident_status, 'in_progress'::public.incident_status])) AND (resolution_summary IS NULL) AND (dismissal_justification IS NULL)))),
    CONSTRAINT security_incidents_sla_order CHECK (((sla_acknowledge_by <= sla_investigate_by) AND (sla_investigate_by <= sla_resolve_by))),
    CONSTRAINT security_incidents_workflow_timestamps CHECK ((((acknowledged_at IS NULL) OR (acknowledged_at >= created_at)) AND ((investigation_started_at IS NULL) OR (investigation_started_at >= created_at)) AND ((resolved_at IS NULL) OR (resolved_at >= created_at))))
);


ALTER TABLE public.security_incidents OWNER TO avian;

--
-- Name: TABLE security_incidents; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON TABLE public.security_incidents IS 'Security incidents escalated from alerts with SLA tracking and ownership preservation';


--
-- Name: COLUMN security_incidents.sla_acknowledge_by; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_incidents.sla_acknowledge_by IS 'SLA deadline for acknowledging the incident';


--
-- Name: COLUMN security_incidents.sla_investigate_by; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_incidents.sla_investigate_by IS 'SLA deadline for starting investigation';


--
-- Name: COLUMN security_incidents.sla_resolve_by; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_incidents.sla_resolve_by IS 'SLA deadline for resolving the incident';


--
-- Name: COLUMN security_incidents.acknowledged_at; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_incidents.acknowledged_at IS 'When analyst clicked "Start Work" (first time only)';


--
-- Name: COLUMN security_incidents.investigation_started_at; Type: COMMENT; Schema: public; Owner: avian
--

COMMENT ON COLUMN public.security_incidents.investigation_started_at IS 'When investigation actually started (first time only)';


--
-- Name: security_tickets; Type: VIEW; Schema: public; Owner: avian
--

CREATE VIEW public.security_tickets AS
 SELECT id,
    tenant_id,
    requester,
    assignee,
    title,
    description,
    severity,
    priority,
    status,
    tags,
    sla_deadline,
    created_at,
    updated_at,
    category
   FROM public.tickets
  WHERE (category = ANY (ARRAY['security_incident'::public.ticket_category, 'vulnerability'::public.ticket_category, 'malware_detection'::public.ticket_category, 'phishing_attempt'::public.ticket_category, 'data_breach'::public.ticket_category, 'policy_violation'::public.ticket_category, 'compliance'::public.ticket_category]));


ALTER VIEW public.security_tickets OWNER TO avian;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    ip_address inet,
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sessions OWNER TO avian;

--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description text,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_settings OWNER TO avian;

--
-- Name: ticket_attachments; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_path text NOT NULL,
    uploaded_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_attachments OWNER TO avian;

--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: avian
--

CREATE TABLE public.ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_comments OWNER TO avian;

--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_audit_logs auth_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.auth_audit_logs
    ADD CONSTRAINT auth_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: compliance_controls compliance_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.compliance_controls
    ADD CONSTRAINT compliance_controls_pkey PRIMARY KEY (id);


--
-- Name: compliance_evidence compliance_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.compliance_evidence
    ADD CONSTRAINT compliance_evidence_pkey PRIMARY KEY (id);


--
-- Name: compliance_frameworks compliance_frameworks_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.compliance_frameworks
    ADD CONSTRAINT compliance_frameworks_pkey PRIMARY KEY (id);


--
-- Name: investigation_playbooks investigation_playbooks_name_version_unique; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.investigation_playbooks
    ADD CONSTRAINT investigation_playbooks_name_version_unique UNIQUE (name, version);


--
-- Name: investigation_playbooks investigation_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.investigation_playbooks
    ADD CONSTRAINT investigation_playbooks_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_history password_history_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_pkey PRIMARY KEY (id);


--
-- Name: playbook_classification_links playbook_classification_links_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.playbook_classification_links
    ADD CONSTRAINT playbook_classification_links_pkey PRIMARY KEY (playbook_id, classification);


--
-- Name: security_alerts security_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.security_alerts
    ADD CONSTRAINT security_alerts_pkey PRIMARY KEY (id);


--
-- Name: security_alerts security_alerts_tenant_source_unique; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.security_alerts
    ADD CONSTRAINT security_alerts_tenant_source_unique UNIQUE (tenant_id, source_system, source_id);


--
-- Name: security_incidents security_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_unique UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_domain_unique; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_domain_unique UNIQUE (domain);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: ticket_attachments ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: alerts_category_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX alerts_category_idx ON public.alerts USING btree (category);


--
-- Name: alerts_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX alerts_created_at_idx ON public.alerts USING btree (created_at);


--
-- Name: alerts_severity_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX alerts_severity_idx ON public.alerts USING btree (severity);


--
-- Name: alerts_source_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX alerts_source_idx ON public.alerts USING btree (source);


--
-- Name: alerts_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX alerts_status_idx ON public.alerts USING btree (status);


--
-- Name: alerts_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX alerts_tenant_idx ON public.alerts USING btree (tenant_id);


--
-- Name: audit_logs_action_created_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_action_created_idx ON public.audit_logs USING btree (action, created_at);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_auth_actions_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_auth_actions_idx ON public.audit_logs USING btree (action) WHERE (((action)::text ~~ 'auth.%'::text) OR ((action)::text ~~ 'security.%'::text));


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_high_risk_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_high_risk_idx ON public.audit_logs USING btree (risk_score, created_at) WHERE (risk_score >= 50);


--
-- Name: audit_logs_resource_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_resource_idx ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: audit_logs_risk_score_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_risk_score_idx ON public.audit_logs USING btree (risk_score);


--
-- Name: audit_logs_session_id_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_session_id_idx ON public.audit_logs USING btree (session_id);


--
-- Name: audit_logs_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_tenant_idx ON public.audit_logs USING btree (tenant_id);


--
-- Name: audit_logs_user_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX audit_logs_user_idx ON public.audit_logs USING btree (user_id);


--
-- Name: auth_audit_logs_action_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_action_idx ON public.auth_audit_logs USING btree (action);


--
-- Name: auth_audit_logs_action_result_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_action_result_idx ON public.auth_audit_logs USING btree (action, result, created_at DESC);


--
-- Name: auth_audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_created_at_idx ON public.auth_audit_logs USING btree (created_at DESC);


--
-- Name: auth_audit_logs_email_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_email_idx ON public.auth_audit_logs USING btree (email);


--
-- Name: auth_audit_logs_ip_address_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_ip_address_idx ON public.auth_audit_logs USING btree (ip_address);


--
-- Name: auth_audit_logs_metadata_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_metadata_idx ON public.auth_audit_logs USING gin (metadata);


--
-- Name: auth_audit_logs_result_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_result_idx ON public.auth_audit_logs USING btree (result);


--
-- Name: auth_audit_logs_user_action_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_user_action_idx ON public.auth_audit_logs USING btree (user_id, action, created_at DESC);


--
-- Name: auth_audit_logs_user_id_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX auth_audit_logs_user_id_idx ON public.auth_audit_logs USING btree (user_id);


--
-- Name: compliance_controls_assigned_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_controls_assigned_idx ON public.compliance_controls USING btree (assigned_to);


--
-- Name: compliance_controls_framework_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_controls_framework_idx ON public.compliance_controls USING btree (framework_id);


--
-- Name: compliance_controls_review_date_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_controls_review_date_idx ON public.compliance_controls USING btree (next_review_date);


--
-- Name: compliance_controls_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_controls_status_idx ON public.compliance_controls USING btree (status);


--
-- Name: compliance_evidence_control_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_evidence_control_idx ON public.compliance_evidence USING btree (control_id);


--
-- Name: compliance_evidence_uploader_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_evidence_uploader_idx ON public.compliance_evidence USING btree (uploaded_by);


--
-- Name: compliance_frameworks_active_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_frameworks_active_idx ON public.compliance_frameworks USING btree (is_active);


--
-- Name: compliance_frameworks_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX compliance_frameworks_tenant_idx ON public.compliance_frameworks USING btree (tenant_id);


--
-- Name: idx_tickets_created_at; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX idx_tickets_created_at ON public.tickets USING btree (created_at);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


--
-- Name: idx_tickets_tenant_id; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX idx_tickets_tenant_id ON public.tickets USING btree (tenant_id);


--
-- Name: investigation_playbooks_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX investigation_playbooks_created_at_idx ON public.investigation_playbooks USING btree (created_at DESC);


--
-- Name: investigation_playbooks_created_by_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX investigation_playbooks_created_by_idx ON public.investigation_playbooks USING btree (created_by);


--
-- Name: investigation_playbooks_name_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX investigation_playbooks_name_idx ON public.investigation_playbooks USING btree (name);


--
-- Name: investigation_playbooks_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX investigation_playbooks_status_idx ON public.investigation_playbooks USING btree (status);


--
-- Name: notifications_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at);


--
-- Name: notifications_read_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX notifications_read_idx ON public.notifications USING btree (is_read);


--
-- Name: notifications_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX notifications_tenant_idx ON public.notifications USING btree (tenant_id);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id);


--
-- Name: password_history_user_created_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX password_history_user_created_idx ON public.password_history USING btree (user_id, created_at DESC);


--
-- Name: password_history_user_id_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX password_history_user_id_idx ON public.password_history USING btree (user_id);


--
-- Name: playbook_classification_links_classification_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX playbook_classification_links_classification_idx ON public.playbook_classification_links USING btree (classification);


--
-- Name: playbook_classification_links_one_active_primary_per_classifica; Type: INDEX; Schema: public; Owner: avian
--

CREATE UNIQUE INDEX playbook_classification_links_one_active_primary_per_classifica ON public.playbook_classification_links USING btree (classification) WHERE ((is_primary = true) AND (playbook_status = 'active'::public.playbook_status));


--
-- Name: playbook_classification_links_playbook_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX playbook_classification_links_playbook_idx ON public.playbook_classification_links USING btree (playbook_id);


--
-- Name: playbook_classification_links_primary_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX playbook_classification_links_primary_idx ON public.playbook_classification_links USING btree (is_primary);


--
-- Name: playbook_classification_links_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX playbook_classification_links_status_idx ON public.playbook_classification_links USING btree (playbook_status);


--
-- Name: security_alerts_assigned_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_assigned_at_idx ON public.security_alerts USING btree (assigned_at DESC);


--
-- Name: security_alerts_assigned_to_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_assigned_to_idx ON public.security_alerts USING btree (assigned_to);


--
-- Name: security_alerts_classification_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_classification_idx ON public.security_alerts USING btree (classification);


--
-- Name: security_alerts_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_created_at_idx ON public.security_alerts USING btree (created_at DESC);


--
-- Name: security_alerts_detected_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_detected_at_idx ON public.security_alerts USING btree (detected_at DESC);


--
-- Name: security_alerts_severity_created_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_severity_created_idx ON public.security_alerts USING btree (severity, created_at);


--
-- Name: security_alerts_severity_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_severity_idx ON public.security_alerts USING btree (severity);


--
-- Name: security_alerts_source_system_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_source_system_idx ON public.security_alerts USING btree (source_system);


--
-- Name: security_alerts_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_status_idx ON public.security_alerts USING btree (status);


--
-- Name: security_alerts_tenant_assigned_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_tenant_assigned_idx ON public.security_alerts USING btree (tenant_id, assigned_to);


--
-- Name: security_alerts_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_tenant_idx ON public.security_alerts USING btree (tenant_id);


--
-- Name: security_alerts_tenant_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_alerts_tenant_status_idx ON public.security_alerts USING btree (tenant_id, status);


--
-- Name: security_incidents_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_created_at_idx ON public.security_incidents USING btree (created_at DESC);


--
-- Name: security_incidents_owner_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_owner_idx ON public.security_incidents USING btree (owner_id);


--
-- Name: security_incidents_severity_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_severity_idx ON public.security_incidents USING btree (severity);


--
-- Name: security_incidents_sla_acknowledge_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_sla_acknowledge_idx ON public.security_incidents USING btree (sla_acknowledge_by);


--
-- Name: security_incidents_sla_investigate_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_sla_investigate_idx ON public.security_incidents USING btree (sla_investigate_by);


--
-- Name: security_incidents_sla_resolve_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_sla_resolve_idx ON public.security_incidents USING btree (sla_resolve_by);


--
-- Name: security_incidents_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_status_idx ON public.security_incidents USING btree (status);


--
-- Name: security_incidents_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_tenant_idx ON public.security_incidents USING btree (tenant_id);


--
-- Name: security_incidents_tenant_owner_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_tenant_owner_idx ON public.security_incidents USING btree (tenant_id, owner_id);


--
-- Name: security_incidents_tenant_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX security_incidents_tenant_status_idx ON public.security_incidents USING btree (tenant_id, status);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_token_hash_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX sessions_token_hash_idx ON public.sessions USING btree (token_hash);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: tenants_active_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tenants_active_idx ON public.tenants USING btree (is_active);


--
-- Name: tenants_domain_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tenants_domain_idx ON public.tenants USING btree (domain);


--
-- Name: ticket_attachments_ticket_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX ticket_attachments_ticket_idx ON public.ticket_attachments USING btree (ticket_id);


--
-- Name: ticket_attachments_uploader_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX ticket_attachments_uploader_idx ON public.ticket_attachments USING btree (uploaded_by);


--
-- Name: ticket_comments_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX ticket_comments_created_at_idx ON public.ticket_comments USING btree (created_at);


--
-- Name: ticket_comments_ticket_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX ticket_comments_ticket_idx ON public.ticket_comments USING btree (ticket_id);


--
-- Name: ticket_comments_user_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX ticket_comments_user_idx ON public.ticket_comments USING btree (user_id);


--
-- Name: tickets_assignee_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_assignee_idx ON public.tickets USING btree (assignee);


--
-- Name: tickets_category_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_category_idx ON public.tickets USING btree (category);


--
-- Name: tickets_created_at_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_created_at_idx ON public.tickets USING btree (created_at);


--
-- Name: tickets_general_category_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_general_category_idx ON public.tickets USING btree (category) WHERE (category = ANY (ARRAY['general_request'::public.ticket_category, 'other'::public.ticket_category]));


--
-- Name: tickets_it_category_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_it_category_idx ON public.tickets USING btree (category) WHERE (category = ANY (ARRAY['it_support'::public.ticket_category, 'hardware_issue'::public.ticket_category, 'software_issue'::public.ticket_category, 'network_issue'::public.ticket_category, 'access_request'::public.ticket_category, 'account_setup'::public.ticket_category]));


--
-- Name: tickets_priority_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_priority_idx ON public.tickets USING btree (priority);


--
-- Name: tickets_requester_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_requester_idx ON public.tickets USING btree (requester);


--
-- Name: tickets_security_category_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_security_category_idx ON public.tickets USING btree (category) WHERE (category = ANY (ARRAY['security_incident'::public.ticket_category, 'vulnerability'::public.ticket_category, 'malware_detection'::public.ticket_category, 'phishing_attempt'::public.ticket_category, 'data_breach'::public.ticket_category, 'policy_violation'::public.ticket_category, 'compliance'::public.ticket_category]));


--
-- Name: tickets_severity_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_severity_idx ON public.tickets USING btree (severity);


--
-- Name: tickets_sla_deadline_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_sla_deadline_idx ON public.tickets USING btree (sla_deadline);


--
-- Name: tickets_status_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_status_idx ON public.tickets USING btree (status);


--
-- Name: tickets_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX tickets_tenant_idx ON public.tickets USING btree (tenant_id);


--
-- Name: users_account_locked_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_account_locked_idx ON public.users USING btree (account_locked);


--
-- Name: users_active_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_active_idx ON public.users USING btree (is_active);


--
-- Name: users_email_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_email_tenant_idx ON public.users USING btree (email, tenant_id);


--
-- Name: users_failed_attempts_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_failed_attempts_idx ON public.users USING btree (failed_login_attempts);


--
-- Name: users_last_failed_login_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_last_failed_login_idx ON public.users USING btree (last_failed_login);


--
-- Name: users_locked_until_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_locked_until_idx ON public.users USING btree (locked_until) WHERE (locked_until IS NOT NULL);


--
-- Name: users_mfa_setup_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_mfa_setup_idx ON public.users USING btree (mfa_setup_completed);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: users_tenant_idx; Type: INDEX; Schema: public; Owner: avian
--

CREATE INDEX users_tenant_idx ON public.users USING btree (tenant_id);


--
-- Name: users trigger_check_failed_login_attempts; Type: TRIGGER; Schema: public; Owner: avian
--

CREATE TRIGGER trigger_check_failed_login_attempts BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.check_failed_login_attempts();


--
-- Name: investigation_playbooks trigger_sync_playbook_classification_status; Type: TRIGGER; Schema: public; Owner: avian
--

CREATE TRIGGER trigger_sync_playbook_classification_status AFTER UPDATE ON public.investigation_playbooks FOR EACH ROW EXECUTE FUNCTION public.sync_playbook_classification_status();


--
-- Name: users trigger_track_password_history; Type: TRIGGER; Schema: public; Owner: avian
--

CREATE TRIGGER trigger_track_password_history AFTER UPDATE ON public.users FOR EACH ROW WHEN ((new.password_hash IS DISTINCT FROM old.password_hash)) EXECUTE FUNCTION public.trigger_add_password_to_history();


--
-- Name: investigation_playbooks trigger_update_investigation_playbooks_updated_at; Type: TRIGGER; Schema: public; Owner: avian
--

CREATE TRIGGER trigger_update_investigation_playbooks_updated_at BEFORE UPDATE ON public.investigation_playbooks FOR EACH ROW EXECUTE FUNCTION public.update_investigation_playbooks_updated_at();


--
-- Name: security_alerts trigger_update_security_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: avian
--

CREATE TRIGGER trigger_update_security_alerts_updated_at BEFORE UPDATE ON public.security_alerts FOR EACH ROW EXECUTE FUNCTION public.update_security_alerts_updated_at();


--
-- Name: security_incidents trigger_update_security_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: avian
--

CREATE TRIGGER trigger_update_security_incidents_updated_at BEFORE UPDATE ON public.security_incidents FOR EACH ROW EXECUTE FUNCTION public.update_security_incidents_updated_at();


--
-- Name: audit_logs audit_logs_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: auth_audit_logs auth_audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.auth_audit_logs
    ADD CONSTRAINT auth_audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: compliance_controls compliance_controls_framework_id_compliance_frameworks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.compliance_controls
    ADD CONSTRAINT compliance_controls_framework_id_compliance_frameworks_id_fk FOREIGN KEY (framework_id) REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE;


--
-- Name: compliance_evidence compliance_evidence_control_id_compliance_controls_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.compliance_evidence
    ADD CONSTRAINT compliance_evidence_control_id_compliance_controls_id_fk FOREIGN KEY (control_id) REFERENCES public.compliance_controls(id) ON DELETE CASCADE;


--
-- Name: investigation_playbooks investigation_playbooks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.investigation_playbooks
    ADD CONSTRAINT investigation_playbooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: password_history password_history_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT password_history_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: playbook_classification_links playbook_classification_links_playbook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.playbook_classification_links
    ADD CONSTRAINT playbook_classification_links_playbook_id_fkey FOREIGN KEY (playbook_id) REFERENCES public.investigation_playbooks(id) ON DELETE CASCADE;


--
-- Name: security_alerts security_alerts_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.security_alerts
    ADD CONSTRAINT security_alerts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_alerts security_alerts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.security_alerts
    ADD CONSTRAINT security_alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: security_incidents security_incidents_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: security_incidents security_incidents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ticket_attachments ticket_attachments_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_comments ticket_comments_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: avian
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: TABLE auth_audit_logs; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.auth_audit_logs TO PUBLIC;


--
-- Name: TABLE failed_login_attempts; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.failed_login_attempts TO PUBLIC;


--
-- Name: TABLE general_tickets; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.general_tickets TO PUBLIC;


--
-- Name: TABLE it_support_tickets; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.it_support_tickets TO PUBLIC;


--
-- Name: TABLE locked_accounts; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.locked_accounts TO PUBLIC;


--
-- Name: TABLE password_history; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.password_history TO PUBLIC;
GRANT INSERT,DELETE ON TABLE public.password_history TO password_admin;


--
-- Name: TABLE password_history_stats; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.password_history_stats TO PUBLIC;


--
-- Name: TABLE security_events; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.security_events TO PUBLIC;


--
-- Name: TABLE security_tickets; Type: ACL; Schema: public; Owner: avian
--

GRANT SELECT ON TABLE public.security_tickets TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict yZmBmd2Jz04m87nT8rxRtzgZtxbhiFUcF8CdmCt0bq95Vy0qjSOo3rLXjTYlQGs

