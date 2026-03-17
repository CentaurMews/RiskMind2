import { db } from "@workspace/db";
import {
  tenantsTable,
  usersTable,
  risksTable,
  vendorsTable,
  signalsTable,
  alertsTable,
  frameworksTable,
  frameworkRequirementsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./password";

// Framework requirement data inlined from scripts/src/framework-data/

const iso27001Requirements: { code: string; title: string; parent?: string }[] = [
  { code: "A.5", title: "Organizational controls" },
  { code: "A.5.1", title: "Policies for information security", parent: "A.5" },
  { code: "A.5.2", title: "Information security roles and responsibilities", parent: "A.5" },
  { code: "A.5.3", title: "Segregation of duties", parent: "A.5" },
  { code: "A.5.4", title: "Management responsibilities", parent: "A.5" },
  { code: "A.5.5", title: "Contact with authorities", parent: "A.5" },
  { code: "A.5.6", title: "Contact with special interest groups", parent: "A.5" },
  { code: "A.5.7", title: "Threat intelligence", parent: "A.5" },
  { code: "A.5.8", title: "Information security in project management", parent: "A.5" },
  { code: "A.5.9", title: "Inventory of information and other associated assets", parent: "A.5" },
  { code: "A.5.10", title: "Acceptable use of information and other associated assets", parent: "A.5" },
  { code: "A.5.11", title: "Return of assets", parent: "A.5" },
  { code: "A.5.12", title: "Classification of information", parent: "A.5" },
  { code: "A.5.13", title: "Labelling of information", parent: "A.5" },
  { code: "A.5.14", title: "Information transfer", parent: "A.5" },
  { code: "A.5.15", title: "Access control", parent: "A.5" },
  { code: "A.5.16", title: "Identity management", parent: "A.5" },
  { code: "A.5.17", title: "Authentication information", parent: "A.5" },
  { code: "A.5.18", title: "Access rights", parent: "A.5" },
  { code: "A.5.19", title: "Information security in supplier relationships", parent: "A.5" },
  { code: "A.5.20", title: "Addressing information security within supplier agreements", parent: "A.5" },
  { code: "A.5.21", title: "Managing information security in the ICT supply chain", parent: "A.5" },
  { code: "A.5.22", title: "Monitoring, review and change management of supplier services", parent: "A.5" },
  { code: "A.5.23", title: "Information security for use of cloud services", parent: "A.5" },
  { code: "A.5.24", title: "Information security incident management planning and preparation", parent: "A.5" },
  { code: "A.5.25", title: "Assessment and decision on information security events", parent: "A.5" },
  { code: "A.5.26", title: "Response to information security incidents", parent: "A.5" },
  { code: "A.5.27", title: "Learning from information security incidents", parent: "A.5" },
  { code: "A.5.28", title: "Collection of evidence", parent: "A.5" },
  { code: "A.5.29", title: "Information security during disruption", parent: "A.5" },
  { code: "A.5.30", title: "ICT readiness for business continuity", parent: "A.5" },
  { code: "A.5.31", title: "Legal, statutory, regulatory and contractual requirements", parent: "A.5" },
  { code: "A.5.32", title: "Intellectual property rights", parent: "A.5" },
  { code: "A.5.33", title: "Protection of records", parent: "A.5" },
  { code: "A.5.34", title: "Privacy and protection of PII", parent: "A.5" },
  { code: "A.5.35", title: "Independent review of information security", parent: "A.5" },
  { code: "A.5.36", title: "Compliance with policies, rules and standards for information security", parent: "A.5" },
  { code: "A.5.37", title: "Documented operating procedures", parent: "A.5" },
  { code: "A.6", title: "People controls" },
  { code: "A.6.1", title: "Screening", parent: "A.6" },
  { code: "A.6.2", title: "Terms and conditions of employment", parent: "A.6" },
  { code: "A.6.3", title: "Information security awareness, education and training", parent: "A.6" },
  { code: "A.6.4", title: "Disciplinary process", parent: "A.6" },
  { code: "A.6.5", title: "Responsibilities after termination or change of employment", parent: "A.6" },
  { code: "A.6.6", title: "Confidentiality or non-disclosure agreements", parent: "A.6" },
  { code: "A.6.7", title: "Remote working", parent: "A.6" },
  { code: "A.6.8", title: "Information security event reporting", parent: "A.6" },
  { code: "A.7", title: "Physical controls" },
  { code: "A.7.1", title: "Physical security perimeters", parent: "A.7" },
  { code: "A.7.2", title: "Physical entry", parent: "A.7" },
  { code: "A.7.3", title: "Securing offices, rooms and facilities", parent: "A.7" },
  { code: "A.7.4", title: "Physical security monitoring", parent: "A.7" },
  { code: "A.7.5", title: "Protecting against physical and environmental threats", parent: "A.7" },
  { code: "A.7.6", title: "Working in secure areas", parent: "A.7" },
  { code: "A.7.7", title: "Clear desk and clear screen", parent: "A.7" },
  { code: "A.7.8", title: "Equipment siting and protection", parent: "A.7" },
  { code: "A.7.9", title: "Security of assets off-premises", parent: "A.7" },
  { code: "A.7.10", title: "Storage media", parent: "A.7" },
  { code: "A.7.11", title: "Supporting utilities", parent: "A.7" },
  { code: "A.7.12", title: "Cabling security", parent: "A.7" },
  { code: "A.7.13", title: "Equipment maintenance", parent: "A.7" },
  { code: "A.7.14", title: "Secure disposal or re-use of equipment", parent: "A.7" },
  { code: "A.8", title: "Technological controls" },
  { code: "A.8.1", title: "User endpoint devices", parent: "A.8" },
  { code: "A.8.2", title: "Privileged access rights", parent: "A.8" },
  { code: "A.8.3", title: "Information access restriction", parent: "A.8" },
  { code: "A.8.4", title: "Access to source code", parent: "A.8" },
  { code: "A.8.5", title: "Secure authentication", parent: "A.8" },
  { code: "A.8.6", title: "Capacity management", parent: "A.8" },
  { code: "A.8.7", title: "Protection against malware", parent: "A.8" },
  { code: "A.8.8", title: "Management of technical vulnerabilities", parent: "A.8" },
  { code: "A.8.9", title: "Configuration management", parent: "A.8" },
  { code: "A.8.10", title: "Information deletion", parent: "A.8" },
  { code: "A.8.11", title: "Data masking", parent: "A.8" },
  { code: "A.8.12", title: "Data leakage prevention", parent: "A.8" },
  { code: "A.8.13", title: "Information backup", parent: "A.8" },
  { code: "A.8.14", title: "Redundancy of information processing facilities", parent: "A.8" },
  { code: "A.8.15", title: "Logging", parent: "A.8" },
  { code: "A.8.16", title: "Monitoring activities", parent: "A.8" },
  { code: "A.8.17", title: "Clock synchronization", parent: "A.8" },
  { code: "A.8.18", title: "Use of privileged utility programs", parent: "A.8" },
  { code: "A.8.19", title: "Installation of software on operational systems", parent: "A.8" },
  { code: "A.8.20", title: "Networks security", parent: "A.8" },
  { code: "A.8.21", title: "Security of network services", parent: "A.8" },
  { code: "A.8.22", title: "Segregation of networks", parent: "A.8" },
  { code: "A.8.23", title: "Web filtering", parent: "A.8" },
  { code: "A.8.24", title: "Use of cryptography", parent: "A.8" },
  { code: "A.8.25", title: "Secure development life cycle", parent: "A.8" },
  { code: "A.8.26", title: "Application security requirements", parent: "A.8" },
  { code: "A.8.27", title: "Secure system architecture and engineering principles", parent: "A.8" },
  { code: "A.8.28", title: "Secure coding", parent: "A.8" },
  { code: "A.8.29", title: "Security testing in development and acceptance", parent: "A.8" },
  { code: "A.8.30", title: "Outsourced development", parent: "A.8" },
  { code: "A.8.31", title: "Separation of development, test and production environments", parent: "A.8" },
  { code: "A.8.32", title: "Change management", parent: "A.8" },
  { code: "A.8.33", title: "Test information", parent: "A.8" },
  { code: "A.8.34", title: "Protection of information systems during audit testing", parent: "A.8" },
];

const soc2Requirements: { code: string; title: string; parent?: string }[] = [
  { code: "CC1", title: "Control Environment" },
  { code: "CC1.1", title: "COSO Principle 1: Demonstrates commitment to integrity and ethical values", parent: "CC1" },
  { code: "CC1.2", title: "COSO Principle 2: Board exercises oversight responsibility", parent: "CC1" },
  { code: "CC1.3", title: "COSO Principle 3: Establishes structure, authority, and responsibility", parent: "CC1" },
  { code: "CC1.4", title: "COSO Principle 4: Demonstrates commitment to competence", parent: "CC1" },
  { code: "CC1.5", title: "COSO Principle 5: Enforces accountability", parent: "CC1" },
  { code: "CC2", title: "Communication and Information" },
  { code: "CC2.1", title: "COSO Principle 13: Uses relevant, quality information", parent: "CC2" },
  { code: "CC2.2", title: "COSO Principle 14: Communicates internally", parent: "CC2" },
  { code: "CC2.3", title: "COSO Principle 15: Communicates externally", parent: "CC2" },
  { code: "CC3", title: "Risk Assessment" },
  { code: "CC3.1", title: "COSO Principle 6: Specifies suitable objectives", parent: "CC3" },
  { code: "CC3.2", title: "COSO Principle 7: Identifies and analyzes risk", parent: "CC3" },
  { code: "CC3.3", title: "COSO Principle 8: Assesses fraud risk", parent: "CC3" },
  { code: "CC3.4", title: "COSO Principle 9: Identifies and analyzes significant change", parent: "CC3" },
  { code: "CC4", title: "Monitoring Activities" },
  { code: "CC4.1", title: "COSO Principle 16: Selects, develops, and performs ongoing and/or separate evaluations", parent: "CC4" },
  { code: "CC4.2", title: "COSO Principle 17: Evaluates and communicates deficiencies", parent: "CC4" },
  { code: "CC5", title: "Control Activities" },
  { code: "CC5.1", title: "COSO Principle 10: Selects and develops control activities", parent: "CC5" },
  { code: "CC5.2", title: "COSO Principle 11: Selects and develops general controls over technology", parent: "CC5" },
  { code: "CC5.3", title: "COSO Principle 12: Deploys through policies and procedures", parent: "CC5" },
  { code: "CC6", title: "Logical and Physical Access Controls" },
  { code: "CC6.1", title: "Logical access security software, infrastructure, and architectures", parent: "CC6" },
  { code: "CC6.2", title: "Prior to issuing system credentials, registered and authorized", parent: "CC6" },
  { code: "CC6.3", title: "Based on authorization, access to protected information assets", parent: "CC6" },
  { code: "CC6.4", title: "Restrictions on physical access to facilities", parent: "CC6" },
  { code: "CC6.5", title: "Discontinues logical and physical protections over physical assets", parent: "CC6" },
  { code: "CC6.6", title: "Security measures against threats outside system boundaries", parent: "CC6" },
  { code: "CC6.7", title: "Restricts the transmission, movement, and removal of information", parent: "CC6" },
  { code: "CC6.8", title: "Controls against threats from malicious software", parent: "CC6" },
  { code: "CC7", title: "System Operations" },
  { code: "CC7.1", title: "Detection and monitoring procedures for security events", parent: "CC7" },
  { code: "CC7.2", title: "Monitors system components for anomalies", parent: "CC7" },
  { code: "CC7.3", title: "Evaluates security events for incidents", parent: "CC7" },
  { code: "CC7.4", title: "Responds to identified security incidents", parent: "CC7" },
  { code: "CC7.5", title: "Identifies and develops activities to mitigate incidents", parent: "CC7" },
  { code: "CC8", title: "Change Management" },
  { code: "CC8.1", title: "Authorizes, designs, develops, configures, documents, tests, approves changes", parent: "CC8" },
  { code: "CC9", title: "Risk Mitigation" },
  { code: "CC9.1", title: "Identifies and assesses risks to objectives", parent: "CC9" },
  { code: "CC9.2", title: "Assesses and manages risks associated with vendors and partners", parent: "CC9" },
  { code: "A1", title: "Additional Criteria for Availability" },
  { code: "A1.1", title: "Maintains, monitors, and evaluates current processing capacity", parent: "A1" },
  { code: "A1.2", title: "Authorizes, designs, develops environmental protections and recovery infrastructure", parent: "A1" },
  { code: "A1.3", title: "Tests recovery plan procedures", parent: "A1" },
  { code: "C1", title: "Additional Criteria for Confidentiality" },
  { code: "C1.1", title: "Identifies and maintains confidential information", parent: "C1" },
  { code: "C1.2", title: "Disposes of confidential information", parent: "C1" },
  { code: "PI1", title: "Additional Criteria for Processing Integrity" },
  { code: "PI1.1", title: "Obtains or generates, uses, and communicates relevant quality information", parent: "PI1" },
  { code: "PI1.2", title: "Implements policies and procedures for system processing", parent: "PI1" },
  { code: "PI1.3", title: "Implements policies and procedures for inputs", parent: "PI1" },
  { code: "PI1.4", title: "Implements policies and procedures for outputs", parent: "PI1" },
  { code: "PI1.5", title: "Implements policies and procedures to store inputs, items in processing, and outputs", parent: "PI1" },
  { code: "P1", title: "Additional Criteria for Privacy" },
  { code: "P1.1", title: "Notice and communication of objectives", parent: "P1" },
  { code: "P2", title: "Privacy - Choice and Consent" },
  { code: "P2.1", title: "Communicates choices available and obtains consent", parent: "P2" },
  { code: "P3", title: "Privacy - Collection" },
  { code: "P3.1", title: "Collects personal information consistent with objectives", parent: "P3" },
  { code: "P3.2", title: "Collects personal information from third parties for specified purposes", parent: "P3" },
  { code: "P4", title: "Privacy - Use, Retention, and Disposal" },
  { code: "P4.1", title: "Limits use of personal information to purposes stated in notice", parent: "P4" },
  { code: "P4.2", title: "Retains personal information consistent with objectives", parent: "P4" },
  { code: "P4.3", title: "Securely disposes of personal information", parent: "P4" },
  { code: "P5", title: "Privacy - Access" },
  { code: "P5.1", title: "Grants identified and authenticated data subjects access to their personal information", parent: "P5" },
  { code: "P5.2", title: "Corrects, amends, or appends personal information", parent: "P5" },
  { code: "P6", title: "Privacy - Disclosure and Notification" },
  { code: "P6.1", title: "Discloses personal information to third parties with consent", parent: "P6" },
  { code: "P6.2", title: "Creates and disseminates information about privacy incidents", parent: "P6" },
  { code: "P6.3", title: "Provides notice of changes to privacy practices", parent: "P6" },
  { code: "P6.4", title: "Provides information about personal information held", parent: "P6" },
  { code: "P6.5", title: "Obtains privacy commitments from third parties", parent: "P6" },
  { code: "P6.6", title: "Remediation of unauthorized personal information", parent: "P6" },
  { code: "P6.7", title: "Notifies affected individuals, regulators, and others of personal information breaches", parent: "P6" },
  { code: "P7", title: "Privacy - Quality" },
  { code: "P7.1", title: "Collects and maintains accurate, up-to-date, complete, and relevant personal information", parent: "P7" },
  { code: "P8", title: "Privacy - Monitoring and Enforcement" },
  { code: "P8.1", title: "Performs compliance reviews and documents resolution", parent: "P8" },
];

const nistCsfRequirements: { code: string; title: string; parent?: string }[] = [
  { code: "GV", title: "Govern" },
  { code: "GV.OC", title: "Organizational Context", parent: "GV" },
  { code: "GV.OC-01", title: "The organizational mission is understood and informs cybersecurity risk management", parent: "GV.OC" },
  { code: "GV.OC-02", title: "Internal and external stakeholders are understood, and their needs and expectations are understood and considered", parent: "GV.OC" },
  { code: "GV.OC-03", title: "Legal, regulatory, and contractual requirements are understood and managed", parent: "GV.OC" },
  { code: "GV.OC-04", title: "Critical objectives, capabilities, and services that stakeholders depend on are understood and communicated", parent: "GV.OC" },
  { code: "GV.OC-05", title: "Outcomes, capabilities, and services that the organization depends on are understood and communicated", parent: "GV.OC" },
  { code: "GV.RM", title: "Risk Management Strategy", parent: "GV" },
  { code: "GV.RM-01", title: "Risk management objectives are established and agreed to by organizational stakeholders", parent: "GV.RM" },
  { code: "GV.RM-02", title: "Risk appetite and risk tolerance statements are established, communicated, and maintained", parent: "GV.RM" },
  { code: "GV.RM-03", title: "Cybersecurity risk management activities and outcomes are included in enterprise risk management processes", parent: "GV.RM" },
  { code: "GV.RM-04", title: "Strategic direction that describes appropriate risk response options is established and communicated", parent: "GV.RM" },
  { code: "GV.RM-05", title: "Lines of communication across the organization are established for cybersecurity risks", parent: "GV.RM" },
  { code: "GV.RM-06", title: "A standardized method for calculating, documenting, categorizing, and prioritizing cybersecurity risks is established", parent: "GV.RM" },
  { code: "GV.RM-07", title: "Strategic opportunities are characterized and included in organizational cybersecurity risk discussions", parent: "GV.RM" },
  { code: "GV.RR", title: "Roles, Responsibilities, and Authorities", parent: "GV" },
  { code: "GV.RR-01", title: "Organizational leadership is responsible and accountable for cybersecurity risk", parent: "GV.RR" },
  { code: "GV.RR-02", title: "Roles, responsibilities, and authorities are established, communicated, understood, and enforced", parent: "GV.RR" },
  { code: "GV.RR-03", title: "Adequate resources are allocated commensurate with the cybersecurity risk strategy", parent: "GV.RR" },
  { code: "GV.RR-04", title: "Cybersecurity is included in human resources practices", parent: "GV.RR" },
  { code: "GV.PO", title: "Policy", parent: "GV" },
  { code: "GV.PO-01", title: "Policy for managing cybersecurity risks is established based on organizational context, cybersecurity strategy, and priorities", parent: "GV.PO" },
  { code: "GV.PO-02", title: "Policy for managing cybersecurity risks is reviewed, updated, communicated, and enforced", parent: "GV.PO" },
  { code: "GV.SC", title: "Cybersecurity Supply Chain Risk Management", parent: "GV" },
  { code: "GV.SC-01", title: "A cybersecurity supply chain risk management program, strategy, objectives, policies, and processes are established and agreed to", parent: "GV.SC" },
  { code: "GV.SC-02", title: "Cybersecurity roles and responsibilities for suppliers, customers, and partners are established, communicated, and coordinated", parent: "GV.SC" },
  { code: "GV.SC-03", title: "Cybersecurity supply chain risk management is integrated into cybersecurity and enterprise risk management", parent: "GV.SC" },
  { code: "GV.SC-04", title: "Suppliers are known and prioritized by criticality", parent: "GV.SC" },
  { code: "GV.SC-05", title: "Requirements to address cybersecurity risks in supply chains are established, prioritized, and integrated", parent: "GV.SC" },
  { code: "GV.SC-06", title: "Planning and due diligence are performed to reduce risks before entering into formal supplier or other third-party relationships", parent: "GV.SC" },
  { code: "GV.SC-07", title: "The risks posed by a supplier, their products and services, and other third parties are understood, recorded, and prioritized", parent: "GV.SC" },
  { code: "GV.SC-08", title: "Relevant suppliers and other third parties are included in incident planning, response, and recovery activities", parent: "GV.SC" },
  { code: "GV.SC-09", title: "Supply chain security practices are integrated into cybersecurity and enterprise risk management programs", parent: "GV.SC" },
  { code: "GV.SC-10", title: "Cybersecurity supply chain risk management plans include provisions for activities that occur after the conclusion of a partnership", parent: "GV.SC" },
  { code: "ID", title: "Identify" },
  { code: "ID.AM", title: "Asset Management", parent: "ID" },
  { code: "ID.AM-01", title: "Inventories of hardware managed by the organization are maintained", parent: "ID.AM" },
  { code: "ID.AM-02", title: "Inventories of software, services, and systems managed by the organization are maintained", parent: "ID.AM" },
  { code: "ID.AM-03", title: "Representations of the organization's authorized network communication and internal and external network data flows are maintained", parent: "ID.AM" },
  { code: "ID.AM-04", title: "Inventories of services provided by suppliers are maintained", parent: "ID.AM" },
  { code: "ID.AM-05", title: "Assets are prioritized based on classification, criticality, resources, and impact on the mission", parent: "ID.AM" },
  { code: "ID.AM-07", title: "Inventories of data and corresponding metadata for designated data types are maintained", parent: "ID.AM" },
  { code: "ID.AM-08", title: "Systems, hardware, software, services, and data are managed throughout their life cycles", parent: "ID.AM" },
  { code: "ID.RA", title: "Risk Assessment", parent: "ID" },
  { code: "ID.RA-01", title: "Vulnerabilities in assets are identified, validated, and recorded", parent: "ID.RA" },
  { code: "ID.RA-02", title: "Cyber threat intelligence is received from information sharing forums and sources", parent: "ID.RA" },
  { code: "ID.RA-03", title: "Internal and external threats to the organization are identified and recorded", parent: "ID.RA" },
  { code: "ID.RA-04", title: "Potential impacts and likelihoods of threats exploiting vulnerabilities are identified and recorded", parent: "ID.RA" },
  { code: "ID.RA-05", title: "Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk and inform risk response prioritization", parent: "ID.RA" },
  { code: "ID.RA-06", title: "Risk responses are chosen, prioritized, planned, tracked, and communicated", parent: "ID.RA" },
  { code: "ID.RA-07", title: "Changes and exceptions are managed, assessed for risk impact, recorded, and tracked", parent: "ID.RA" },
  { code: "ID.RA-08", title: "Processes for receiving, analyzing, and responding to vulnerability disclosures are established", parent: "ID.RA" },
  { code: "ID.RA-09", title: "The authenticity and integrity of hardware and software are assessed prior to acquisition and use", parent: "ID.RA" },
  { code: "ID.RA-10", title: "Critical suppliers are assessed prior to acquisition", parent: "ID.RA" },
  { code: "ID.IM", title: "Improvement", parent: "ID" },
  { code: "ID.IM-01", title: "Improvements are identified from evaluations", parent: "ID.IM" },
  { code: "ID.IM-02", title: "Improvements are identified from security tests and exercises", parent: "ID.IM" },
  { code: "ID.IM-03", title: "Improvements are identified from execution of operational processes, procedures, and activities", parent: "ID.IM" },
  { code: "ID.IM-04", title: "Incident response plans and other cybersecurity plans that affect operations are established, communicated, maintained, and improved", parent: "ID.IM" },
  { code: "PR", title: "Protect" },
  { code: "PR.AA", title: "Identity Management, Authentication, and Access Control", parent: "PR" },
  { code: "PR.AA-01", title: "Identities and credentials for authorized users, services, and hardware are managed", parent: "PR.AA" },
  { code: "PR.AA-02", title: "Identities are proofed and bound to credentials based on the context of interactions", parent: "PR.AA" },
  { code: "PR.AA-03", title: "Users, services, and hardware are authenticated", parent: "PR.AA" },
  { code: "PR.AA-04", title: "Identity assertions are protected, conveyed, and verified", parent: "PR.AA" },
  { code: "PR.AA-05", title: "Access permissions, entitlements, and authorizations are defined, managed, enforced, and reviewed", parent: "PR.AA" },
  { code: "PR.AA-06", title: "Physical access to assets is managed, monitored, and enforced commensurate with risk", parent: "PR.AA" },
  { code: "PR.AT", title: "Awareness and Training", parent: "PR" },
  { code: "PR.AT-01", title: "Personnel are provided with awareness and training so that they possess the knowledge and skills to perform general tasks", parent: "PR.AT" },
  { code: "PR.AT-02", title: "Individuals in specialized roles are provided with awareness and training so that they possess the knowledge and skills to perform relevant tasks", parent: "PR.AT" },
  { code: "PR.DS", title: "Data Security", parent: "PR" },
  { code: "PR.DS-01", title: "The confidentiality, integrity, and availability of data-at-rest are protected", parent: "PR.DS" },
  { code: "PR.DS-02", title: "The confidentiality, integrity, and availability of data-in-transit are protected", parent: "PR.DS" },
  { code: "PR.DS-10", title: "The confidentiality, integrity, and availability of data-in-use are protected", parent: "PR.DS" },
  { code: "PR.DS-11", title: "Backups of data are created, protected, maintained, and tested", parent: "PR.DS" },
  { code: "PR.PS", title: "Platform Security", parent: "PR" },
  { code: "PR.PS-01", title: "The configuration of organizational assets is established and maintained", parent: "PR.PS" },
  { code: "PR.PS-02", title: "Software is maintained, replaced, and removed commensurate with risk", parent: "PR.PS" },
  { code: "PR.PS-03", title: "Hardware is maintained, replaced, and removed commensurate with risk", parent: "PR.PS" },
  { code: "PR.PS-04", title: "Log records are generated and made available for continuous monitoring", parent: "PR.PS" },
  { code: "PR.PS-05", title: "Installation and execution of unauthorized software are prevented", parent: "PR.PS" },
  { code: "PR.PS-06", title: "Secure software development practices are integrated, and their performance is monitored", parent: "PR.PS" },
  { code: "PR.IR", title: "Technology Infrastructure Resilience", parent: "PR" },
  { code: "PR.IR-01", title: "Networks and environments are protected from unauthorized logical access and usage", parent: "PR.IR" },
  { code: "PR.IR-02", title: "The organization's technology assets are protected from environmental threats", parent: "PR.IR" },
  { code: "PR.IR-03", title: "Mechanisms are implemented to achieve resilience requirements in normal and adverse situations", parent: "PR.IR" },
  { code: "PR.IR-04", title: "Adequate resource capacity to ensure availability is maintained", parent: "PR.IR" },
  { code: "DE", title: "Detect" },
  { code: "DE.CM", title: "Continuous Monitoring", parent: "DE" },
  { code: "DE.CM-01", title: "Networks and network services are monitored to find potentially adverse events", parent: "DE.CM" },
  { code: "DE.CM-02", title: "The physical environment is monitored to find potentially adverse events", parent: "DE.CM" },
  { code: "DE.CM-03", title: "Personnel activity and technology usage are monitored to find potentially adverse events", parent: "DE.CM" },
  { code: "DE.CM-06", title: "External service provider activities and services are monitored to find potentially adverse events", parent: "DE.CM" },
  { code: "DE.CM-09", title: "Computing hardware and software, runtime environments, and their data are monitored", parent: "DE.CM" },
  { code: "DE.AE", title: "Adverse Event Analysis", parent: "DE" },
  { code: "DE.AE-02", title: "Potentially adverse events are analyzed to better understand associated activities", parent: "DE.AE" },
  { code: "DE.AE-03", title: "Information is correlated from multiple sources", parent: "DE.AE" },
  { code: "DE.AE-04", title: "The estimated impact and scope of adverse events are understood", parent: "DE.AE" },
  { code: "DE.AE-06", title: "Information on adverse events is provided to authorized staff and tools", parent: "DE.AE" },
  { code: "DE.AE-07", title: "Cyber threat intelligence and other contextual information are integrated into the analysis", parent: "DE.AE" },
  { code: "DE.AE-08", title: "Incidents are declared when adverse events meet the defined incident criteria", parent: "DE.AE" },
  { code: "RS", title: "Respond" },
  { code: "RS.MA", title: "Incident Management", parent: "RS" },
  { code: "RS.MA-01", title: "The incident response plan is executed in coordination with relevant third parties", parent: "RS.MA" },
  { code: "RS.MA-02", title: "Incident reports are triaged and validated", parent: "RS.MA" },
  { code: "RS.MA-03", title: "Incidents are categorized and prioritized", parent: "RS.MA" },
  { code: "RS.MA-04", title: "Incidents are escalated or elevated as needed", parent: "RS.MA" },
  { code: "RS.MA-05", title: "The criteria for initiating incident recovery are applied", parent: "RS.MA" },
  { code: "RS.AN", title: "Incident Analysis", parent: "RS" },
  { code: "RS.AN-03", title: "Analysis is performed to establish what has taken place during an incident", parent: "RS.AN" },
  { code: "RS.AN-06", title: "Actions performed during an investigation are recorded", parent: "RS.AN" },
  { code: "RS.AN-07", title: "Incident data and metadata are collected, and their integrity and provenance are preserved", parent: "RS.AN" },
  { code: "RS.AN-08", title: "An incident's magnitude is estimated and validated", parent: "RS.AN" },
  { code: "RS.CO", title: "Incident Response Reporting and Communication", parent: "RS" },
  { code: "RS.CO-02", title: "Internal and external stakeholders are notified of incidents", parent: "RS.CO" },
  { code: "RS.CO-03", title: "Information is shared with designated internal and external stakeholders", parent: "RS.CO" },
  { code: "RS.MI", title: "Incident Mitigation", parent: "RS" },
  { code: "RS.MI-01", title: "Incidents are contained", parent: "RS.MI" },
  { code: "RS.MI-02", title: "Incidents are eradicated", parent: "RS.MI" },
  { code: "RC", title: "Recover" },
  { code: "RC.RP", title: "Incident Recovery Plan Execution", parent: "RC" },
  { code: "RC.RP-01", title: "The recovery portion of the incident response plan is executed once initiated", parent: "RC.RP" },
  { code: "RC.RP-02", title: "Recovery actions are selected, scoped, and prioritized", parent: "RC.RP" },
  { code: "RC.RP-03", title: "The integrity of backups and other restoration assets is verified before using them for restoration", parent: "RC.RP" },
  { code: "RC.RP-04", title: "Critical mission functions and cybersecurity risk management are considered to establish post-incident operational norms", parent: "RC.RP" },
  { code: "RC.RP-05", title: "The integrity of restored assets is verified, systems and services are restored, and normal operating status is confirmed", parent: "RC.RP" },
  { code: "RC.RP-06", title: "The end of incident recovery is declared based on criteria, and incident-related documentation is completed", parent: "RC.RP" },
  { code: "RC.CO", title: "Incident Recovery Communication", parent: "RC" },
  { code: "RC.CO-03", title: "Recovery activities and progress in restoring operational capabilities are communicated to designated internal and external stakeholders", parent: "RC.CO" },
  { code: "RC.CO-04", title: "Public updates on incident recovery are shared using approved methods and messaging", parent: "RC.CO" },
];

async function seedRequirements(
  tenantId: string,
  frameworkId: string,
  requirements: { code: string; title: string; parent?: string }[],
  descPrefix: string
): Promise<number> {
  const codeToId: Record<string, string> = {};
  for (const r of requirements) {
    const [inserted] = await db.insert(frameworkRequirementsTable).values({
      tenantId,
      frameworkId,
      code: r.code,
      title: r.title,
      description: `${descPrefix}: ${r.title}`,
      parentId: r.parent ? codeToId[r.parent] || null : null,
    }).returning();
    codeToId[r.code] = inserted.id;
  }
  return Object.keys(codeToId).length;
}

export async function seedDemoDataIfEmpty(): Promise<void> {
  try {
    const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, "acme")).limit(1);
    if (existing.length > 0) {
      return;
    }

    console.log("[Seed] No Acme Corp tenant found — seeding demo data...");

    const [tenant] = await db.insert(tenantsTable).values({
      name: "Acme Corp",
      slug: "acme",
      settings: {},
    }).returning();

    console.log(`[Seed] Created tenant: ${tenant.name} (${tenant.id})`);

    const password = await hashPassword("password123");

    const userDefs = [
      { email: "admin@acme.com", name: "Admin User", role: "admin" as const },
      { email: "riskmanager@acme.com", name: "Risk Manager", role: "risk_manager" as const },
      { email: "riskowner@acme.com", name: "Risk Owner", role: "risk_owner" as const },
      { email: "auditor@acme.com", name: "Auditor User", role: "auditor" as const },
      { email: "viewer@acme.com", name: "Viewer User", role: "viewer" as const },
      { email: "vendor@acme.com", name: "Vendor User", role: "vendor" as const },
    ];

    const users = await db.insert(usersTable).values(
      userDefs.map((u) => ({
        tenantId: tenant.id,
        email: u.email,
        name: u.name,
        role: u.role,
        hashedPassword: password,
      }))
    ).returning();

    console.log(`[Seed] Created ${users.length} users`);

    const adminUser = users.find((u) => u.role === "admin")!;
    const rmUser = users.find((u) => u.role === "risk_manager")!;
    const roUser = users.find((u) => u.role === "risk_owner")!;

    const riskDefs = [
      { title: "Cloud Provider Outage", category: "technology" as const, status: "open" as const, likelihood: 3, impact: 5, ownerId: roUser.id },
      { title: "Data Breach via Third-Party", category: "technology" as const, status: "open" as const, likelihood: 2, impact: 5, ownerId: rmUser.id },
      { title: "Regulatory Non-Compliance Fine", category: "compliance" as const, status: "open" as const, likelihood: 2, impact: 4, ownerId: rmUser.id },
      { title: "Key Employee Departure", category: "operational" as const, status: "mitigated" as const, likelihood: 3, impact: 3, ownerId: roUser.id },
      { title: "Supply Chain Disruption", category: "operational" as const, status: "open" as const, likelihood: 4, impact: 4, ownerId: roUser.id },
      { title: "Fraud and Financial Misstatement", category: "financial" as const, status: "draft" as const, likelihood: 1, impact: 5, ownerId: adminUser.id },
      { title: "Reputational Damage from Social Media", category: "reputational" as const, status: "open" as const, likelihood: 3, impact: 3, ownerId: rmUser.id },
      { title: "Cyber Ransomware Attack", category: "technology" as const, status: "open" as const, likelihood: 2, impact: 5, ownerId: rmUser.id },
      { title: "Market Expansion Failure", category: "strategic" as const, status: "accepted" as const, likelihood: 3, impact: 2, ownerId: adminUser.id },
      { title: "Vendor Lock-in Dependency", category: "strategic" as const, status: "open" as const, likelihood: 4, impact: 3, ownerId: roUser.id },
    ];

    const risks = await db.insert(risksTable).values(
      riskDefs.map((r) => ({
        tenantId: tenant.id,
        title: r.title,
        description: `Risk scenario: ${r.title}. This risk requires continuous monitoring and mitigation efforts.`,
        category: r.category,
        status: r.status,
        likelihood: r.likelihood,
        impact: r.impact,
        ownerId: r.ownerId,
      }))
    ).returning();

    console.log(`[Seed] Created ${risks.length} risks`);

    const vendorDefs = [
      { name: "CloudScale Inc", tier: "critical" as const, status: "monitoring" as const, category: "Infrastructure", contactEmail: "security@cloudscale.io" },
      { name: "DataGuard Pro", tier: "high" as const, status: "monitoring" as const, category: "Security", contactEmail: "vendor@dataguard.com" },
      { name: "PayFlow Systems", tier: "critical" as const, status: "monitoring" as const, category: "Payments", contactEmail: "compliance@payflow.io" },
      { name: "OfficeHub SaaS", tier: "medium" as const, status: "monitoring" as const, category: "Productivity", contactEmail: "admin@officehub.com" },
      { name: "MarketBridge Analytics", tier: "low" as const, status: "identification" as const, category: "Analytics", contactEmail: "info@marketbridge.co" },
    ];

    const vendors = await db.insert(vendorsTable).values(
      vendorDefs.map((v) => ({
        tenantId: tenant.id,
        name: v.name,
        description: `Third-party vendor: ${v.name}`,
        tier: v.tier,
        status: v.status,
        category: v.category,
        contactEmail: v.contactEmail,
        riskScore: String(Math.floor(Math.random() * 50) + 30),
      }))
    ).returning();

    console.log(`[Seed] Created ${vendors.length} vendors`);

    const signalDefs = [
      { source: "SIEM", content: "Unusual login patterns detected from Eastern Europe IP range", status: "pending" as const },
      { source: "Threat Intel Feed", content: "New CVE published affecting cloud storage providers", status: "triaged" as const, classification: "technology" },
      { source: "Manual Report", content: "Vendor DataGuard Pro reported a security incident affecting their infrastructure", status: "finding" as const, classification: "third_party" },
    ];

    await db.insert(signalsTable).values(
      signalDefs.map((s) => ({
        tenantId: tenant.id,
        source: s.source,
        content: s.content,
        status: s.status,
        classification: s.classification || null,
      }))
    );

    console.log("[Seed] Created 3 signals");

    await db.insert(alertsTable).values([
      {
        tenantId: tenant.id,
        type: "kri_breach",
        title: "Critical KRI Breach: System Uptime Below Threshold",
        description: "System uptime KRI has breached critical threshold of 99.5%",
        severity: "critical",
        status: "active",
        context: { kriName: "System Uptime", currentValue: 98.2, threshold: 99.5 },
      },
      {
        tenantId: tenant.id,
        type: "overdue_review",
        title: "Overdue Risk Review: Cloud Provider Outage",
        description: "Risk review for Cloud Provider Outage is 5 days past due",
        severity: "medium",
        status: "active",
        context: { riskTitle: "Cloud Provider Outage", daysPastDue: 5 },
      },
    ]);

    console.log("[Seed] Created 2 alerts");

    const [isoFramework] = await db.insert(frameworksTable).values({
      tenantId: tenant.id,
      name: "ISO 27001:2022",
      version: "2022",
      type: "iso",
      description: "Information security management systems — Requirements",
    }).returning();

    const isoCount = await seedRequirements(tenant.id, isoFramework.id, iso27001Requirements, "ISO 27001:2022 requirement");
    console.log(`[Seed] Created ISO 27001 framework with ${isoCount} requirements`);

    const [soc2Framework] = await db.insert(frameworksTable).values({
      tenantId: tenant.id,
      name: "SOC 2 Type II",
      version: "2017",
      type: "soc2",
      description: "Trust Services Criteria for Security, Availability, and Confidentiality",
    }).returning();

    const soc2Count = await seedRequirements(tenant.id, soc2Framework.id, soc2Requirements, "SOC 2 Trust Services Criteria");
    console.log(`[Seed] Created SOC 2 framework with ${soc2Count} requirements`);

    const [nistFramework] = await db.insert(frameworksTable).values({
      tenantId: tenant.id,
      name: "NIST CSF 2.0",
      version: "2.0",
      type: "nist",
      description: "NIST Cybersecurity Framework 2.0",
    }).returning();

    const nistCount = await seedRequirements(tenant.id, nistFramework.id, nistCsfRequirements, "NIST CSF 2.0");
    console.log(`[Seed] Created NIST CSF 2.0 framework with ${nistCount} requirements`);

    console.log(`[Seed] Done — Acme Corp demo dataset created. Login: any-user@acme.com / password123`);
  } catch (err) {
    console.error("[Seed] Failed:", err);
  }
}
