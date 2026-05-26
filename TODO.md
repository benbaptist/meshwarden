- Track and display detailed analytics on the actual Mesh and its quality, packets, etc. tucked away somewhere clean and neat

- Add search to Channels page too; mirror Contacts page UI

- individual Contact page improvements
    - Activity panel should be INSIDE the Info panel as a button that you can click into its own (for both mobile/desktop viewports) with a back button
        - To clairfy, there should no longer be an 'Activity' panel (either always visible or mobile; never!) but rather a page/screen
    - Telemetry requests needs a UI for password entry; some nodes won't allow no-pass telemetry
    - Repeaters should not have chat interfaces whatsoever; remove that ability entirely
    - Telemetry overhaul
        - Telemetry button next to ping button, which opens a little modal for entering a password (which can be optional; some contacts do not require a pass, but you won't know until you submit with the way the meshcore protocol is laid out) for telemetry. then, it waits until telemtry is received
        - telemetry timeout should be rather forgiving; perhaps 30s~?
        - Render telemetry beautifully, instead of just showing JSON. render unknown telemetry data gracefully somehow too
    - Repeater admin overhaul
        - Again, another 'page' (within that panel) that you can click into, not just apart of the Info page, complete with its own back button 
        - Ping and Request Telemetry make no sense for the Admin; neither is explicitly admin-related at all. Remove.
        - Actually implement real admin functionality/remote management functions that MeshCore repeaters support
            - Request detailed status
            - Command Line area (that's technically what the Chat funtionality does with a repeater; it's just access to the Repeaters' CLI)
            - Various UIable commands
            - All available settings configurable; never pre-load settings from the mesh, but rather, have individual refresh buttons to reduce mesh traffic, that can 'fetch' that setting from the node on-demand

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