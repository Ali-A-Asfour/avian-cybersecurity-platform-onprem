---
inclusion: fileMatch
fileMatchPattern: 'setup_local_dev.sh|src/strands_agent.py|infra/deploy_agent.py|test/initialize_agent.py'
---

Your task is to help a user leverage Bedrock AgentCore Runtime to deploy an agentic application.  You must follow these instructions in order:

1. Run `setup_local_dev.sh` to prepare the local dev environment
2. Use the AWS Documentation Tools to review the documentatinon on AgentCore Runtime to ensure you understand this service.
3. Use the Strands Agents Tools to review docmentation on Strands Agents
4. Update `src/strands_agent.py` to implement the use case required for this project.
5. Ask the user to review and confirm the agent code.  Do not move forward until the user has confirmed the agent code.
6. Ask the user to enable the Bedrock model_id needed for the agent if it's not already enabled in the account.
7. Use `infra/deploy_agent.py` to deploy the agent
8. **Test the deployed agent using the provided test script**: Use the existing `test/initialize_agent.py` script to verify agent end-to-end functionality. This script is specifically designed for testing deployed agents and includes:
   - Proper authentication handling
   - Streaming response processing  
   - Interactive and single-prompt modes
   - Error handling and debugging
   
   **Testing approaches:**
   - For single test: `python test/initialize_agent.py --prompt "Your test message here"`
   - For interactive testing: `python test/initialize_agent.py --interactive`

9. Inform the user that their agent has been successfully deployed.
10. Update implementation-plan.md with the current status

Rules for designing agentic applications:
- Implement workflows where possible.  If there are any steps or decisions that can reasonably be moved from a language model call to code, you should do it.  This will make the system faster, cheaper, and more consistent.
- Only give agents access to tools that they will need for that component of the workflow.
- Always use the provided memory_hook for conversational agents
- After you have modified the agent for the use case, always remove any unused code and imports

Rules for testing:
- **Always use the existing `test/initialize_agent.py` script** for testing deployed agents
- Do NOT create additional test scripts or testing utilities - the provided script handles all testing scenarios
- The `initialize_agent.py` script includes proper authentication, streaming, error handling, and both interactive and single-prompt modes
- Focus on using the existing tools rather than building new ones
