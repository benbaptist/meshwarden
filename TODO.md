- Track and display detailed analytics on the actual Mesh and its quality, packets, etc. tucked away somewhere clean and neat

- Path UI should show direct hex AS WELL AS showing what contacts those hex hashes may represent (can't be 100% certain since collisions are aboslutely possible), as well as facilities for easily selecting a new path via the GUI

- Settings page is an outlier
    - Area for Groups
        - Ability to assign automations to groups; these apply to all nodes within group
            - ensure all automations are staggered with substantial delays between each contact, to prevent overwhelming mesh traffic, and limit minimum automation time to 1hr at the fastest
            - Automation for checking telemetry
            - Automation for zero-hop pinging 
            - Futureproof for future automations
    - Edit button on node does nothing; make it take us to a new novel page for editing node settings 
        - in addition to editing basic node settings, ensure it's futureproof for future per-node settinsg that we may implement

- Tools 
    - Nearby repeater scanner

- Functioning map

- Chatbot functionality (on a per-configured node basis)
    - ping commands
    - weather commands
    - automated weather alerts