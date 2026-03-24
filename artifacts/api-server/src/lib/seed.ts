import { db } from "@workspace/db";
import {
  tenantsTable,
  usersTable,
  risksTable,
  vendorsTable,
  signalsTable,
  findingsTable,
  alertsTable,
  frameworksTable,
  frameworkRequirementsTable,
  assessmentsTable,
  assessmentTemplatesTable,
  treatmentsTable,
  treatmentStatusEventsTable,
  krisTable,
  incidentsTable,
  reviewCyclesTable,
  vendorSubprocessorsTable,
  orgDependenciesTable,
  monitoringConfigsTable,
  riskAppetiteConfigsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "./password";
import { seedPrebuiltTemplates } from "@workspace/db/seed/prebuilt-templates";

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

// Helper to offset current date by N days
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// --------------------------------------------------------------------------
// Task 1 seed functions
// --------------------------------------------------------------------------

type User = { id: string; role: string };
type Risk = { id: string };
type Vendor = { id: string };

async function seedExpandedRisks(
  tenantId: string,
  adminUser: User,
  rmUser: User,
  roUser: User
): Promise<Risk[]> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM risks WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 10) {
    // Already seeded beyond the base 10
    return [];
  }

  const owners = [adminUser, rmUser, roUser];
  const expandedRiskDefs = [
    // technology
    {
      title: "API Gateway Rate Limiting Failure",
      category: "technology" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 4,
      ownerId: roUser.id,
    },
    {
      title: "Legacy System End-of-Life",
      category: "technology" as const,
      status: "open" as const,
      likelihood: 4,
      impact: 3,
      ownerId: rmUser.id,
    },
    {
      title: "Shadow IT Proliferation",
      category: "technology" as const,
      status: "draft" as const,
      likelihood: 3,
      impact: 3,
      ownerId: roUser.id,
    },
    {
      title: "DNS Hijacking Attack",
      category: "technology" as const,
      status: "mitigated" as const,
      likelihood: 2,
      impact: 4,
      ownerId: adminUser.id,
      residualLikelihood: 1,
      residualImpact: 3,
    },
    {
      title: "Database Credential Exposure",
      category: "technology" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 5,
      ownerId: rmUser.id,
    },
    // operational
    {
      title: "Business Continuity Plan Gaps",
      category: "operational" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 4,
      ownerId: roUser.id,
    },
    {
      title: "Inadequate Change Management",
      category: "operational" as const,
      status: "draft" as const,
      likelihood: 2,
      impact: 3,
      ownerId: adminUser.id,
    },
    {
      title: "Third-Party SLA Violations",
      category: "operational" as const,
      status: "open" as const,
      likelihood: 4,
      impact: 3,
      ownerId: rmUser.id,
    },
    // compliance
    {
      title: "GDPR Data Subject Rights Violations",
      category: "compliance" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 5,
      ownerId: rmUser.id,
    },
    {
      title: "SOX Internal Controls Weakness",
      category: "compliance" as const,
      status: "mitigated" as const,
      likelihood: 2,
      impact: 4,
      ownerId: adminUser.id,
      residualLikelihood: 1,
      residualImpact: 3,
    },
    {
      title: "Cross-Border Data Transfer Risk",
      category: "compliance" as const,
      status: "draft" as const,
      likelihood: 3,
      impact: 4,
      ownerId: roUser.id,
    },
    // financial
    {
      title: "Foreign Exchange Exposure",
      category: "financial" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 3,
      ownerId: adminUser.id,
    },
    {
      title: "Credit Counterparty Default",
      category: "financial" as const,
      status: "accepted" as const,
      likelihood: 2,
      impact: 4,
      ownerId: adminUser.id,
    },
    {
      title: "Insurance Coverage Gaps",
      category: "financial" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 3,
      ownerId: rmUser.id,
    },
    // strategic
    {
      title: "Digital Transformation Delays",
      category: "strategic" as const,
      status: "open" as const,
      likelihood: 3,
      impact: 3,
      ownerId: roUser.id,
    },
    {
      title: "Competitor IP Litigation",
      category: "strategic" as const,
      status: "draft" as const,
      likelihood: 2,
      impact: 5,
      ownerId: adminUser.id,
    },
    // reputational
    {
      title: "Customer Data Privacy Concerns",
      category: "reputational" as const,
      status: "open" as const,
      likelihood: 4,
      impact: 4,
      ownerId: rmUser.id,
    },
    {
      title: "Regulatory Investigation Publicity",
      category: "reputational" as const,
      status: "mitigated" as const,
      likelihood: 2,
      impact: 5,
      ownerId: roUser.id,
      residualLikelihood: 1,
      residualImpact: 4,
    },
  ];

  const newRisks = await db.insert(risksTable).values(
    expandedRiskDefs.map((r) => ({
      tenantId,
      title: r.title,
      description: `Risk scenario: ${r.title}. This risk requires continuous monitoring and mitigation efforts aligned with Acme Corp's financial services risk framework.`,
      category: r.category,
      status: r.status,
      likelihood: r.likelihood,
      impact: r.impact,
      ownerId: r.ownerId,
      residualLikelihood: "residualLikelihood" in r ? r.residualLikelihood : null,
      residualImpact: "residualImpact" in r ? r.residualImpact : null,
    }))
  ).returning();

  console.log(`[Seed] Created ${newRisks.length} expanded risks`);
  return newRisks;
}

async function seedTreatments(
  tenantId: string,
  adminUser: User,
  rmUser: User,
  roUser: User,
  baseRisks: Risk[],
  expandedRisks: Risk[]
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM treatments WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  // Base risks by index: 0=Cloud Provider, 1=Data Breach, 2=Regulatory, 7=Ransomware, 8=Market Expansion, 9=Vendor Lock-in
  // Expanded risks by index (0-based):
  //   0=API Gateway Rate Limiting, 1=Legacy System, 7=Third-Party SLA Violations
  //   8=GDPR, 9=SOX, 10=Cross-Border, 11=Foreign Exchange
  const cloudRisk = baseRisks[0];
  const ransomwareRisk = baseRisks[7];
  const marketRisk = baseRisks[8];
  const regulatoryRisk = baseRisks[2];
  const apiGatewayRisk = expandedRisks[0];
  const legacySystemRisk = expandedRisks[1];
  const slaViolationsRisk = expandedRisks[7];
  const gdprRisk = expandedRisks[8];
  const soxRisk = expandedRisks[9];
  const fxRisk = expandedRisks[11];

  const treatmentDefs = [
    {
      riskId: cloudRisk.id,
      strategy: "treat" as const,
      description: "Implement multi-cloud failover architecture with automated failover to secondary provider within 15 minutes",
      status: "in_progress" as const,
      cost: "250000",
      dueDate: daysFromNow(60),
      ownerId: rmUser.id,
    },
    {
      riskId: ransomwareRisk.id,
      strategy: "transfer" as const,
      description: "Procure comprehensive cyber insurance policy covering ransomware, data breach, and business interruption",
      status: "completed" as const,
      cost: "85000",
      ownerId: adminUser.id,
    },
    {
      riskId: marketRisk.id,
      strategy: "tolerate" as const,
      description: "Accept market expansion risk with documented risk tolerance and quarterly board review",
      status: "completed" as const,
      ownerId: adminUser.id,
    },
    {
      riskId: regulatoryRisk.id,
      strategy: "terminate" as const,
      description: "Retire legacy payment gateway and migrate to PCI-DSS compliant modern platform",
      status: "planned" as const,
      dueDate: daysFromNow(90),
      ownerId: rmUser.id,
    },
    {
      riskId: apiGatewayRisk?.id ?? cloudRisk.id,
      strategy: "treat" as const,
      description: "Deploy Web Application Firewall (WAF) and DDoS protection layer in front of API gateway",
      status: "in_progress" as const,
      cost: "120000",
      ownerId: roUser.id,
    },
    {
      riskId: slaViolationsRisk?.id ?? cloudRisk.id,
      strategy: "treat" as const,
      description: "Vendor SLA renegotiation program with enhanced penalty clauses and monthly performance reviews",
      status: "planned" as const,
      dueDate: daysFromNow(45),
      ownerId: rmUser.id,
    },
    {
      riskId: gdprRisk?.id ?? regulatoryRisk.id,
      strategy: "treat" as const,
      description: "GDPR remediation project: subject rights portal, DPA updates, and consent management platform",
      status: "in_progress" as const,
      cost: "180000",
      ownerId: rmUser.id,
    },
    {
      riskId: soxRisk?.id ?? regulatoryRisk.id,
      strategy: "treat" as const,
      description: "SOX controls improvement: segregation of duties matrix, automated monitoring, and quarterly attestation",
      status: "completed" as const,
      cost: "95000",
      ownerId: adminUser.id,
    },
    {
      riskId: fxRisk?.id ?? cloudRisk.id,
      strategy: "transfer" as const,
      description: "Implement FX hedging strategy using forward contracts to cover 80% of USD/EUR exposure",
      status: "in_progress" as const,
      cost: "50000",
      ownerId: adminUser.id,
    },
    {
      riskId: legacySystemRisk?.id ?? cloudRisk.id,
      strategy: "terminate" as const,
      description: "Legacy system migration plan: full decommission and data migration to cloud-native replacement",
      status: "planned" as const,
      dueDate: daysFromNow(180),
      ownerId: roUser.id,
    },
  ];

  const treatments = await db.insert(treatmentsTable).values(
    treatmentDefs.map((t) => ({
      tenantId,
      riskId: t.riskId,
      strategy: t.strategy,
      description: t.description,
      status: t.status,
      cost: t.cost ?? null,
      dueDate: t.dueDate ?? null,
      ownerId: t.ownerId,
    }))
  ).returning();

  // Insert status events for each treatment
  await db.insert(treatmentStatusEventsTable).values(
    treatments.map((t) => ({
      tenantId,
      treatmentId: t.id,
      fromStatus: null,
      toStatus: t.status,
      changedBy: adminUser.id,
      note: "Initial status set during seeding",
    }))
  );

  console.log(`[Seed] Created ${treatments.length} treatments with status events`);
}

async function seedKRIs(
  tenantId: string,
  baseRisks: Risk[],
  expandedRisks: Risk[]
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM kris WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  // Base risks: 0=Cloud Provider, 1=Data Breach, 2=Regulatory, 7=Ransomware, 9=Vendor Lock-in
  // Expanded: 1=Legacy System End-of-Life, 3=DNS Hijacking, 8=GDPR
  const cloudRisk = baseRisks[0];
  const dataBreachRisk = baseRisks[1];
  const regulatoryRisk = baseRisks[2];
  const ransomwareRisk = baseRisks[7];
  const vendorLockRisk = baseRisks[9];
  const legacyRisk = expandedRisks[1];
  const dnsRisk = expandedRisks[3];
  const gdprRisk = expandedRisks[8];

  const kriDefs = [
    {
      riskId: cloudRisk.id,
      name: "System Uptime SLA",
      description: "Percentage uptime across all production systems measured monthly",
      warningThreshold: "99.5",
      criticalThreshold: "99.0",
      currentValue: "99.2",
      unit: "%",
    },
    {
      riskId: ransomwareRisk.id,
      name: "Mean Time to Detect (MTTD)",
      description: "Average time in hours from threat introduction to detection",
      warningThreshold: "4",
      criticalThreshold: "8",
      currentValue: "6.5",
      unit: "hours",
    },
    {
      riskId: dataBreachRisk.id,
      name: "Open Critical Vulnerabilities",
      description: "Count of CVSS 9.0+ vulnerabilities open more than 30 days",
      warningThreshold: "5",
      criticalThreshold: "10",
      currentValue: "12",
      unit: "count",
    },
    {
      riskId: vendorLockRisk.id,
      name: "Vendor Risk Score Average",
      description: "Average risk score across all critical and high tier vendors",
      warningThreshold: "60",
      criticalThreshold: "75",
      currentValue: "58",
      unit: "score",
    },
    {
      riskId: legacyRisk?.id ?? dataBreachRisk.id,
      name: "Patch Compliance Rate",
      description: "Percentage of systems with current security patches applied within SLA",
      warningThreshold: "95",
      criticalThreshold: "90",
      currentValue: "87",
      unit: "%",
    },
    {
      riskId: dnsRisk?.id ?? dataBreachRisk.id,
      name: "Failed Login Attempts (24h)",
      description: "Total failed authentication attempts across all production systems in 24 hours",
      warningThreshold: "100",
      criticalThreshold: "500",
      currentValue: "245",
      unit: "count",
    },
    {
      riskId: gdprRisk?.id ?? regulatoryRisk.id,
      name: "Data Loss Events (Monthly)",
      description: "Count of confirmed or suspected data loss/exfiltration events per month",
      warningThreshold: "2",
      criticalThreshold: "5",
      currentValue: "1",
      unit: "count",
    },
    {
      riskId: regulatoryRisk.id,
      name: "Regulatory Findings Open",
      description: "Count of open regulatory audit findings not yet remediated",
      warningThreshold: "3",
      criticalThreshold: "7",
      currentValue: "4",
      unit: "count",
    },
  ];

  const kris = await db.insert(krisTable).values(
    kriDefs.map((k) => ({
      tenantId,
      riskId: k.riskId,
      name: k.name,
      description: k.description,
      warningThreshold: k.warningThreshold,
      criticalThreshold: k.criticalThreshold,
      currentValue: k.currentValue,
      unit: k.unit,
    }))
  ).returning();

  console.log(`[Seed] Created ${kris.length} KRIs`);
}

async function seedIncidents(
  tenantId: string,
  adminUser: User,
  rmUser: User,
  roUser: User,
  baseRisks: Risk[],
  expandedRisks: Risk[]
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM incidents WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  const cloudRisk = baseRisks[0];
  const dataBreachRisk = baseRisks[1];
  const ransomwareRisk = baseRisks[7];
  const soxRisk = expandedRisks[9];

  const incidentDefs = [
    {
      riskId: ransomwareRisk.id,
      title: "Phishing Campaign Targeting Finance Team",
      description: "A coordinated spear-phishing campaign targeted 12 finance team members. Three employees clicked malicious links. No credentials were compromised after rapid IR response.",
      severity: "high" as const,
      reportedBy: rmUser.id,
      occurredAt: daysFromNow(-45),
      resolvedAt: daysFromNow(-42),
    },
    {
      riskId: cloudRisk.id,
      title: "CloudScale Regional Outage",
      description: "CloudScale us-east-1 suffered a 4-hour regional outage due to network equipment failure. Acme Corp experienced degraded service affecting 2,400 end users.",
      severity: "critical" as const,
      reportedBy: roUser.id,
      occurredAt: daysFromNow(-30),
      resolvedAt: daysFromNow(-29),
    },
    {
      riskId: dataBreachRisk.id,
      title: "Unauthorized Data Export Attempt",
      description: "SIEM detected an anomalous large data export from a customer database by an internal service account. Investigation confirmed no exfiltration occurred; account compromised via credential stuffing.",
      severity: "medium" as const,
      reportedBy: adminUser.id,
      occurredAt: daysFromNow(-15),
      resolvedAt: daysFromNow(-12),
    },
    {
      riskId: soxRisk?.id ?? dataBreachRisk.id,
      title: "SOX Audit Finding — Segregation of Duties",
      description: "External auditors identified that two developers had conflicting access rights allowing them to both develop and deploy code changes to production without peer review.",
      severity: "low" as const,
      reportedBy: rmUser.id,
      occurredAt: daysFromNow(-60),
      resolvedAt: daysFromNow(-50),
    },
  ];

  const incidents = await db.insert(incidentsTable).values(
    incidentDefs.map((i) => ({
      tenantId,
      riskId: i.riskId,
      title: i.title,
      description: i.description,
      severity: i.severity,
      reportedBy: i.reportedBy,
      occurredAt: i.occurredAt,
      resolvedAt: i.resolvedAt,
    }))
  ).returning();

  console.log(`[Seed] Created ${incidents.length} incidents`);
}

async function seedReviewCycles(
  tenantId: string,
  adminUser: User,
  rmUser: User,
  roUser: User,
  baseRisks: Risk[]
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM review_cycles WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  const cloudRisk = baseRisks[0];
  const dataBreachRisk = baseRisks[1];
  const regulatoryRisk = baseRisks[2];
  const supplyChainRisk = baseRisks[4];
  const ransomwareRisk = baseRisks[7];

  const reviewDefs = [
    {
      riskId: cloudRisk.id,
      status: "scheduled" as const,
      dueDate: daysFromNow(10),
      reviewerId: rmUser.id,
      notes: "Quarterly review scheduled following CloudScale outage incident",
    },
    {
      riskId: dataBreachRisk.id,
      status: "overdue" as const,
      dueDate: daysFromNow(-5),
      reviewerId: rmUser.id,
      notes: "Review overdue — awaiting updated vendor security questionnaire response",
    },
    {
      riskId: ransomwareRisk.id,
      status: "completed" as const,
      dueDate: daysFromNow(-20),
      completedAt: daysFromNow(-18),
      reviewerId: adminUser.id,
      notes: "Review completed following phishing incident. Risk score updated, insurance confirmed adequate.",
    },
    {
      riskId: regulatoryRisk.id,
      status: "overdue" as const,
      dueDate: daysFromNow(-15),
      reviewerId: roUser.id,
      notes: "Review delayed pending legal counsel guidance on new regulatory guidance",
    },
    {
      riskId: supplyChainRisk.id,
      status: "scheduled" as const,
      dueDate: daysFromNow(30),
      reviewerId: roUser.id,
      notes: "Annual supply chain risk review with procurement team",
    },
  ];

  const reviews = await db.insert(reviewCyclesTable).values(
    reviewDefs.map((r) => ({
      tenantId,
      riskId: r.riskId,
      reviewerId: r.reviewerId,
      status: r.status,
      dueDate: r.dueDate,
      completedAt: "completedAt" in r ? r.completedAt : null,
      notes: r.notes,
    }))
  ).returning();

  console.log(`[Seed] Created ${reviews.length} review cycles`);
}

// --------------------------------------------------------------------------
// Task 2 seed functions
// --------------------------------------------------------------------------

async function seedExpandedVendors(
  tenantId: string
): Promise<Vendor[]> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM vendors WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 5) {
    // Already seeded beyond the base 5
    return [];
  }

  const expandedVendorDefs = [
    {
      name: "CyberVault Security",
      tier: "critical" as const,
      status: "risk_assessment" as const,
      category: "Security",
      contactEmail: "security@cybervault.io",
      riskScore: "72",
    },
    {
      name: "ComplianceIQ",
      tier: "high" as const,
      status: "due_diligence" as const,
      category: "Compliance",
      contactEmail: "contact@complianceiq.com",
      riskScore: "45",
    },
    {
      name: "NetWatch Monitoring",
      tier: "medium" as const,
      status: "contracting" as const,
      category: "Infrastructure",
      contactEmail: "sales@netwatch.net",
      riskScore: "38",
    },
    {
      name: "TalentStream HR",
      tier: "low" as const,
      status: "onboarding" as const,
      category: "HR",
      contactEmail: "vendor@talentstream.co",
      riskScore: "25",
    },
    {
      name: "LegacyPay Services",
      tier: "high" as const,
      status: "offboarding" as const,
      category: "Payments",
      contactEmail: "admin@legacypay.com",
      riskScore: "81",
    },
    // Akamai CDN Services — needed as subprocessor for CloudScale
    {
      name: "Akamai CDN Services",
      tier: "medium" as const,
      status: "monitoring" as const,
      category: "Infrastructure",
      contactEmail: "enterprise@akamai.com",
      riskScore: "30",
    },
  ];

  const newVendors = await db.insert(vendorsTable).values(
    expandedVendorDefs.map((v) => ({
      tenantId,
      name: v.name,
      description: `Third-party vendor: ${v.name}`,
      tier: v.tier,
      status: v.status,
      category: v.category,
      contactEmail: v.contactEmail,
      riskScore: v.riskScore,
    }))
  ).returning();

  console.log(`[Seed] Created ${newVendors.length} expanded vendors`);
  return newVendors;
}

async function seedSubprocessors(
  tenantId: string,
  baseVendors: Vendor[],
  expandedVendors: Vendor[]
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM vendor_subprocessors WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  // Base vendors: 0=CloudScale, 2=PayFlow
  // Expanded vendors: 2=NetWatch Monitoring, 5=Akamai CDN Services, 4=LegacyPay Services
  const cloudScaleVendor = baseVendors[0];
  const payFlowVendor = baseVendors[2];
  const netWatchVendor = expandedVendors[2];
  const akamaiVendor = expandedVendors[5];
  const legacyPayVendor = expandedVendors[4];

  if (!cloudScaleVendor || !payFlowVendor || !netWatchVendor || !akamaiVendor || !legacyPayVendor) {
    console.log("[Seed] Skipping subprocessors — required vendors not found");
    return;
  }

  const subprocessorDefs = [
    {
      vendorId: cloudScaleVendor.id,
      subprocessorId: netWatchVendor.id,
      criticality: "critical" as const,
      discoveredBy: "manual" as const,
      relationshipType: "Infrastructure hosting",
    },
    {
      vendorId: cloudScaleVendor.id,
      subprocessorId: akamaiVendor.id,
      criticality: "medium" as const,
      discoveredBy: "llm" as const,
      relationshipType: "Content delivery",
    },
    {
      vendorId: payFlowVendor.id,
      subprocessorId: legacyPayVendor.id,
      criticality: "high" as const,
      discoveredBy: "manual" as const,
      relationshipType: "Payment processing fallback",
    },
  ];

  const subprocessors = await db.insert(vendorSubprocessorsTable).values(
    subprocessorDefs.map((s) => ({
      tenantId,
      vendorId: s.vendorId,
      subprocessorId: s.subprocessorId,
      criticality: s.criticality,
      discoveredBy: s.discoveredBy,
      relationshipType: s.relationshipType,
    }))
  ).returning();

  console.log(`[Seed] Created ${subprocessors.length} vendor subprocessor relationships`);
}

async function seedOrgDependencies(
  tenantId: string
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM org_dependencies WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  const orgDepDefs = [
    {
      category: "email" as const,
      providerName: "Microsoft 365",
      vendorId: null,
      criticality: "critical",
      notes: "Primary email and collaboration platform used by all 450+ employees",
    },
    {
      category: "cloud" as const,
      providerName: "Amazon Web Services",
      vendorId: null,
      criticality: "critical",
      notes: "Primary cloud infrastructure provider hosting all production workloads",
    },
    {
      category: "cdn" as const,
      providerName: "Cloudflare",
      vendorId: null,
      criticality: "high",
      notes: "Content delivery and DDoS protection for customer-facing applications",
    },
    {
      category: "identity" as const,
      providerName: "Okta",
      vendorId: null,
      criticality: "critical",
      notes: "Identity provider for SSO and MFA across all internal applications",
    },
  ];

  const deps = await db.insert(orgDependenciesTable).values(
    orgDepDefs.map((d) => ({
      tenantId,
      category: d.category,
      providerName: d.providerName,
      vendorId: d.vendorId,
      criticality: d.criticality,
      notes: d.notes,
    }))
  ).returning();

  console.log(`[Seed] Created ${deps.length} org dependencies`);
}

async function seedMonitoringConfigs(
  tenantId: string
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM monitoring_configs WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  const monitoringDefs = [
    { tier: "critical" as const, cadenceDays: 7, scoreThreshold: 70 },
    { tier: "high" as const, cadenceDays: 30, scoreThreshold: 60 },
    { tier: "medium" as const, cadenceDays: 90, scoreThreshold: 50 },
    { tier: "low" as const, cadenceDays: 180, scoreThreshold: null },
  ];

  const configs = await db.insert(monitoringConfigsTable).values(
    monitoringDefs.map((m) => ({
      tenantId,
      tier: m.tier,
      cadenceDays: m.cadenceDays,
      scoreThreshold: m.scoreThreshold,
    }))
  ).returning();

  console.log(`[Seed] Created ${configs.length} monitoring configs`);
}

async function seedRiskAppetiteConfigs(
  tenantId: string
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM risk_appetite_configs WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    return;
  }

  const appetiteDefs = [
    { category: "technology" as const, threshold: 65 },
    { category: "operational" as const, threshold: 60 },
    { category: "compliance" as const, threshold: 50 },
    { category: "financial" as const, threshold: 55 },
    { category: "strategic" as const, threshold: 70 },
    { category: "reputational" as const, threshold: 60 },
  ];

  const appetiteConfigs = await db.insert(riskAppetiteConfigsTable).values(
    appetiteDefs.map((a) => ({
      tenantId,
      category: a.category,
      threshold: a.threshold,
    }))
  ).returning();

  console.log(`[Seed] Created ${appetiteConfigs.length} risk appetite configs`);
}

// --------------------------------------------------------------------------
// Task 3 seed functions (Plan 18-02)
// --------------------------------------------------------------------------

async function seedAssessments(
  tenantId: string,
  vendors: Vendor[],
  isoFrameworkId: string
): Promise<void> {
  // Step 1: Ensure pre-built templates exist
  await seedPrebuiltTemplates(tenantId);

  // Step 2: Check if assessments already seeded
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM assessments WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    console.log("[Seed] Assessments already seeded, skipping");
    return;
  }

  // Step 3: Look up "Vendor Security Assessment" template
  const [vsTemplate] = await db
    .select({ id: assessmentTemplatesTable.id })
    .from(assessmentTemplatesTable)
    .where(
      sql`tenant_id = ${tenantId} AND title = 'Vendor Security Assessment'`
    )
    .limit(1);

  if (!vsTemplate) {
    console.log("[Seed] Vendor Security Assessment template not found, skipping assessments");
    return;
  }

  // Base vendors: 0=CloudScale, 1=DataGuard Pro, 2=PayFlow Systems
  const cloudScale = vendors[0];
  const dataGuard = vendors[1];
  const payFlow = vendors[2];

  if (!cloudScale || !dataGuard || !payFlow) {
    console.log("[Seed] Required vendors not found, skipping assessments");
    return;
  }

  // CloudScale assessment — score 72.50
  const cloudScaleResponses = {
    "q-vs-001": { value: "true", score: 1.0 },
    "q-vs-002": { value: "16", score: 0.5 },
    "q-vs-003": { value: "quarterly", score: 0.75 },
    "q-vs-006": { value: "true", score: 1.0 },
    "q-vs-007": { value: "AES-256", score: 1.0 },
    "q-vs-008": { value: "true", score: 1.0 },
    "q-vs-011": { value: "true", score: 1.0 },
    "q-vs-013": { value: "6", score: 0.75 },
    "q-vs-014": { value: "48hrs", score: 0.75 },
    "q-vs-016": { value: "true", score: 1.0 },
    "q-vs-017": { value: "4", score: 0.85 },
    "q-vs-018": { value: "8", score: 0.7 },
    "q-vs-019": { value: "quarterly", score: 0.75 },
    "q-vs-020": { value: "true", score: 1.0 },
    "q-vs-021": { value: "true", score: 1.0 },
    "q-vs-022": { value: "in-progress", score: 0.5 },
    "q-vs-023": { value: "true", score: 1.0 },
    "q-vs-025": { value: "true", score: 1.0 },
  };

  // DataGuard Pro assessment — score 55.30 (weaker posture in business continuity)
  const dataGuardResponses = {
    "q-vs-001": { value: "true", score: 1.0 },
    "q-vs-002": { value: "12", score: 0.4 },
    "q-vs-003": { value: "annually", score: 0.5 },
    "q-vs-006": { value: "true", score: 1.0 },
    "q-vs-007": { value: "AES-128", score: 0.75 },
    "q-vs-008": { value: "true", score: 1.0 },
    "q-vs-011": { value: "true", score: 1.0 },
    "q-vs-013": { value: "24", score: 0.4 },
    "q-vs-014": { value: "72hrs", score: 0.5 },
    "q-vs-016": { value: "false", score: 0.0 },
    "q-vs-017": { value: "24", score: 0.3 },
    "q-vs-018": { value: "48", score: 0.2 },
    "q-vs-019": { value: "annually", score: 0.25 },
    "q-vs-020": { value: "false", score: 0.0 },
    "q-vs-021": { value: "true", score: 1.0 },
    "q-vs-022": { value: "in-progress", score: 0.5 },
    "q-vs-023": { value: "true", score: 1.0 },
    "q-vs-025": { value: "false", score: 0.0 },
  };

  // PayFlow Systems assessment — score 81.20 (strong across all sections)
  const payFlowResponses = {
    "q-vs-001": { value: "true", score: 1.0 },
    "q-vs-002": { value: "20", score: 1.0 },
    "q-vs-003": { value: "monthly", score: 1.0 },
    "q-vs-006": { value: "true", score: 1.0 },
    "q-vs-007": { value: "AES-256", score: 1.0 },
    "q-vs-008": { value: "true", score: 1.0 },
    "q-vs-011": { value: "true", score: 1.0 },
    "q-vs-013": { value: "2", score: 1.0 },
    "q-vs-014": { value: "24hrs", score: 1.0 },
    "q-vs-016": { value: "true", score: 1.0 },
    "q-vs-017": { value: "1", score: 1.0 },
    "q-vs-018": { value: "4", score: 0.9 },
    "q-vs-019": { value: "quarterly", score: 0.75 },
    "q-vs-020": { value: "true", score: 1.0 },
    "q-vs-021": { value: "true", score: 1.0 },
    "q-vs-022": { value: "compliant", score: 1.0 },
    "q-vs-023": { value: "true", score: 1.0 },
    "q-vs-025": { value: "true", score: 1.0 },
  };

  // Step 4: Insert 3 completed vendor assessments
  await db.insert(assessmentsTable).values([
    {
      tenantId,
      templateId: vsTemplate.id,
      contextType: "vendor" as const,
      contextId: cloudScale.id,
      status: "completed" as const,
      score: "72.50",
      responses: cloudScaleResponses,
      aiSummary: "CloudScale demonstrates strong encryption practices (AES-256) and has a documented incident response plan tested within 12 months. Key concerns include quarterly-only privileged access reviews and 48-hour breach notification timeline. Business continuity RPO of 4 hours meets requirements. GDPR compliance is in progress. Overall vendor risk is moderate-high due to access control cadence gaps.",
    },
    {
      tenantId,
      templateId: vsTemplate.id,
      contextType: "vendor" as const,
      contextId: dataGuard.id,
      status: "completed" as const,
      score: "55.30",
      responses: dataGuardResponses,
      aiSummary: "DataGuard Pro shows adequate logical access controls but exhibits significant gaps in business continuity planning. No geographically redundant infrastructure is in place, and disaster recovery is tested annually only. Breach notification timeline of 72 hours is below best practice. Password policy minimum of 12 characters is below the recommended 16. Overall vendor risk is elevated with immediate remediation recommended for BCP gaps.",
    },
    {
      tenantId,
      templateId: vsTemplate.id,
      contextType: "vendor" as const,
      contextId: payFlow.id,
      status: "completed" as const,
      score: "81.20",
      responses: payFlowResponses,
      aiSummary: "PayFlow Systems demonstrates an exemplary security posture across all assessment domains. MFA is enforced, encryption uses AES-256, and the incident response plan is actively maintained with monthly privileged access reviews. Business continuity planning is robust with a 1-hour RPO and 4-hour RTO. GDPR compliance is fully achieved. Minor improvement areas include semi-annual DR testing cadence. Overall vendor risk is low.",
    },
  ]);

  // Step 5: Update vendor riskScores based on assessment results
  // riskScore = 100 - assessment score (higher score = lower risk)
  await db.update(vendorsTable).set({ riskScore: "27.50" }).where(eq(vendorsTable.id, cloudScale.id));
  await db.update(vendorsTable).set({ riskScore: "44.70" }).where(eq(vendorsTable.id, dataGuard.id));
  await db.update(vendorsTable).set({ riskScore: "18.80" }).where(eq(vendorsTable.id, payFlow.id));

  // Step 6: Look up "Compliance Control Assessment" template
  const [ccTemplate] = await db
    .select({ id: assessmentTemplatesTable.id })
    .from(assessmentTemplatesTable)
    .where(
      sql`tenant_id = ${tenantId} AND title = 'Compliance Control Assessment'`
    )
    .limit(1);

  if (!ccTemplate) {
    console.log("[Seed] Compliance Control Assessment template not found, skipping compliance assessment");
    return;
  }

  // ISO 27001 compliance control assessment responses
  const isoComplianceResponses = {
    "q-cc-001": { value: "true", score: 1.0 },
    "q-cc-002": { value: "true", score: 1.0 },
    "q-cc-003": { value: "weekly", score: 0.75 },
    "q-cc-004": { value: "preventive", score: 1.0 },
    "q-cc-005": { value: "partially-automated", score: 0.6 },
    "q-cc-006": { value: "7", score: 0.7 },
    "q-cc-007": { value: "true", score: 1.0 },
    "q-cc-008": { value: "2024-03-15", score: 1.0 },
    "q-cc-009": { value: "2024-09-01", score: 1.0 },
    "q-cc-010": { value: "6", score: 0.6 },
    "q-cc-011": { value: "false", score: 0.0 },
    "q-cc-012": { value: "true", score: 1.0 },
    "q-cc-013": { value: "within-90-days", score: 0.75 },
    "q-cc-014": { value: "true", score: 1.0 },
    "q-cc-015": { value: "true", score: 1.0 },
    "q-cc-017": { value: "true", score: 0.0 },
    "q-cc-018": { value: "medium", score: 0.5 },
    "q-cc-019": { value: "true", score: 1.0 },
    "q-cc-020": { value: "60-days", score: 0.75 },
    "q-cc-021": { value: "false", score: 0.0 },
    "q-cc-022": { value: "Two medium-severity gaps identified in access management controls. Remediation plans targeting 60-day resolution are in progress.", score: 1.0 },
  };

  // Step 6: Create compliance assessment for ISO 27001
  await db.insert(assessmentsTable).values({
    tenantId,
    templateId: ccTemplate.id,
    contextType: "framework" as const,
    contextId: isoFrameworkId,
    status: "completed" as const,
    score: "68.40",
    responses: isoComplianceResponses,
    aiSummary: "ISO 27001 control assessment reveals strong control design with documented objectives and assigned owners. Control automation is partial across most areas. Evidence currency needs improvement — 35% of controls have evidence older than 90 days. Two medium-severity gaps identified in access management controls with remediation plans targeting 60-day resolution.",
  });

  console.log("[Seed] Created 3 vendor assessments + 1 compliance assessment, updated vendor riskScores");
}

async function seedExpandedSignals(
  tenantId: string,
  vendors: Vendor[]
): Promise<Record<string, string>> {
  // Check if any signals with contentHash exist (expanded signals guard)
  const hashCountResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM signals WHERE tenant_id = ${tenantId} AND content_hash IS NOT NULL`
  );
  const existingWithHash = (hashCountResult.rows[0] as { cnt: number }).cnt;
  if (existingWithHash > 0) {
    console.log("[Seed] Expanded signals already seeded, skipping");
    // Return a mapping so seedFindings can use the externalIds
    const existing = await db
      .select({ id: signalsTable.id, externalId: signalsTable.externalId })
      .from(signalsTable)
      .where(sql`tenant_id = ${tenantId} AND external_id IS NOT NULL`);
    return Object.fromEntries(existing.filter((s) => s.externalId).map((s) => [s.externalId!, s.id]));
  }

  // Base vendors: 0=CloudScale, 1=DataGuard Pro, 2=PayFlow Systems
  const cloudScale = vendors[0];
  const dataGuard = vendors[1];
  const payFlow = vendors[2];

  const signalDefs = [
    // NVD CVE signals
    {
      source: "nvd",
      content: "CVE-2024-21762: FortiOS out-of-bounds write vulnerability in SSL VPN. CVSS 9.8. Allows remote code execution via crafted HTTP requests.",
      status: "triaged" as const,
      classification: "technology",
      confidence: "0.9500",
      externalId: "CVE-2024-21762",
      vendorId: null as string | null,
      contentHash: "0001000100010001000100010001000100010001000100010001000100010001",
      metadata: { cvssScore: 9.8, cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cweId: "CWE-787", publishedDate: "2024-02-09", affectedProducts: ["FortiOS 7.4.0-7.4.2"] },
    },
    {
      source: "nvd",
      content: "CVE-2024-3400: Palo Alto PAN-OS command injection in GlobalProtect gateway. CVSS 10.0.",
      status: "finding" as const,
      classification: "technology",
      confidence: "0.9800",
      externalId: "CVE-2024-3400",
      vendorId: null as string | null,
      contentHash: "0002000200020002000200020002000200020002000200020002000200020002",
      metadata: { cvssScore: 10.0, cweId: "CWE-77", publishedDate: "2024-04-12" },
    },
    {
      source: "nvd",
      content: "CVE-2024-1709: ConnectWise ScreenConnect authentication bypass. CVSS 10.0.",
      status: "triaged" as const,
      classification: "technology",
      confidence: "0.9500",
      externalId: "CVE-2024-1709",
      vendorId: null as string | null,
      contentHash: "0003000300030003000300030003000300030003000300030003000300030003",
      metadata: { cvssScore: 10.0, cweId: "CWE-288" },
    },
    {
      source: "nvd",
      content: "CVE-2024-27198: JetBrains TeamCity authentication bypass allowing admin access. CVSS 9.8.",
      status: "dismissed" as const,
      classification: "technology",
      confidence: "0.9200",
      externalId: "CVE-2024-27198",
      vendorId: null as string | null,
      contentHash: "0004000400040004000400040004000400040004000400040004000400040004",
      metadata: { cvssScore: 9.8, cweId: "CWE-288" },
    },
    // Shodan signals
    {
      source: "shodan",
      content: "Open port 3389 (RDP) detected on cloudscale.io infrastructure. Service: Microsoft Terminal Services.",
      status: "finding" as const,
      classification: "technology",
      confidence: "0.9000",
      externalId: "shodan-rdp-cloudscale",
      vendorId: cloudScale?.id ?? null,
      contentHash: "0005000500050005000500050005000500050005000500050005000500050005",
      metadata: { ip: "198.51.100.42", port: 3389, service: "Microsoft Terminal Services", transport: "tcp", timestamp: "2024-11-15T08:30:00Z" },
    },
    {
      source: "shodan",
      content: "Exposed MongoDB instance on port 27017 without authentication detected for dataguard.com.",
      status: "triaged" as const,
      classification: "technology",
      confidence: "0.8800",
      externalId: "shodan-mongo-dataguard",
      vendorId: dataGuard?.id ?? null,
      contentHash: "0006000600060006000600060006000600060006000600060006000600060006",
      metadata: { ip: "203.0.113.15", port: 27017, service: "MongoDB", vulns: ["CVE-2023-44487"] },
    },
    {
      source: "shodan",
      content: "SSL certificate expired on payflow.io payment gateway endpoint.",
      status: "pending" as const,
      classification: "technology",
      confidence: "0.8500",
      externalId: "shodan-ssl-payflow",
      vendorId: payFlow?.id ?? null,
      contentHash: "0007000700070007000700070007000700070007000700070007000700070007",
      metadata: { ip: "192.0.2.88", port: 443, certExpiry: "2024-10-01" },
    },
    // Sentinel signals
    {
      source: "sentinel",
      content: "Multiple failed authentication attempts detected from IP 185.220.101.x targeting Azure AD. Potential brute force attack.",
      status: "triaged" as const,
      classification: "technology",
      confidence: "0.9200",
      externalId: "sentinel-bf-20241115",
      vendorId: null as string | null,
      contentHash: "0008000800080008000800080008000800080008000800080008000800080008",
      metadata: { ruleId: "BruteForceAttack", severity: "High", alertCount: 47, sourceIps: ["185.220.101.42", "185.220.101.55"], targetService: "Azure AD" },
    },
    {
      source: "sentinel",
      content: "Anomalous outbound data transfer of 2.4GB detected from finance-app-server to external IP during off-hours.",
      status: "finding" as const,
      classification: "operational",
      confidence: "0.9700",
      externalId: "sentinel-exfil-20241118",
      vendorId: null as string | null,
      contentHash: "0009000900090009000900090009000900090009000900090009000900090009",
      metadata: { ruleId: "DataExfiltration", severity: "Critical", bytesTransferred: 2400000000, destinationIp: "45.33.32.156" },
    },
    {
      source: "sentinel",
      content: "Privilege escalation detected: service account granted Global Admin role outside change window.",
      status: "triaged" as const,
      classification: "technology",
      confidence: "0.9300",
      externalId: "sentinel-privesc-20241120",
      vendorId: null as string | null,
      contentHash: "000a000a000a000a000a000a000a000a000a000a000a000a000a000a000a000a",
      metadata: { ruleId: "PrivilegeEscalation", severity: "High", account: "svc-backup@acme.com" },
    },
    {
      source: "sentinel",
      content: "Impossible travel alert: user login from New York then London within 15 minutes.",
      status: "dismissed" as const,
      classification: "technology",
      confidence: "0.7500",
      externalId: "sentinel-travel-20241122",
      vendorId: null as string | null,
      contentHash: "000b000b000b000b000b000b000b000b000b000b000b000b000b000b000b000b",
      metadata: { ruleId: "ImpossibleTravel", severity: "Medium" },
    },
    // MISP signals
    {
      source: "misp",
      content: "MISP Event #45821: APT28 campaign targeting financial services sector. 3 IP(s), 5 domain(s), 2 hash(es) shared.",
      status: "triaged" as const,
      classification: "technology",
      confidence: "0.9400",
      externalId: "misp-45821",
      vendorId: null as string | null,
      contentHash: "000c000c000c000c000c000c000c000c000c000c000c000c000c000c000c000c",
      metadata: { eventId: 45821, threatLevel: "high", orgSource: "CIRCL", tlp: "amber", attributeCount: { ip: 3, domain: 5, hash: 2 } },
    },
    {
      source: "misp",
      content: "MISP Event #45903: New ransomware variant LockBit 4.0 indicators of compromise. 8 hash(es), 2 URL(s).",
      status: "pending" as const,
      classification: "technology",
      confidence: "0.8800",
      externalId: "misp-45903",
      vendorId: null as string | null,
      contentHash: "000d000d000d000d000d000d000d000d000d000d000d000d000d000d000d000d",
      metadata: { eventId: 45903, threatLevel: "high", orgSource: "FIRST", tlp: "green", attributeCount: { hash: 8, url: 2 } },
    },
    {
      source: "misp",
      content: "MISP Event #46012: Supply chain compromise indicators for npm packages. 4 domain(s), 12 hash(es).",
      status: "triaged" as const,
      classification: "technology",
      confidence: "0.8600",
      externalId: "misp-46012",
      vendorId: null as string | null,
      contentHash: "000e000e000e000e000e000e000e000e000e000e000e000e000e000e000e000e",
      metadata: { eventId: 46012, threatLevel: "medium", attributeCount: { domain: 4, hash: 12 } },
    },
    // Email signals
    {
      source: "email",
      content: "Report from external auditor: Identified gaps in privileged access management controls during quarterly review.",
      status: "finding" as const,
      classification: "compliance",
      confidence: "0.9100",
      externalId: "email-audit-20241125",
      vendorId: null as string | null,
      contentHash: "000f000f000f000f000f000f000f000f000f000f000f000f000f000f000f000f",
      metadata: { from: "auditor@kpmg.com", subject: "Q4 Access Management Review Findings", receivedAt: "2024-11-25T09:15:00Z" },
    },
    {
      source: "email",
      content: "Vendor notification: DataGuard Pro experienced a 4-hour service disruption affecting EU data centers.",
      status: "triaged" as const,
      classification: "third_party",
      confidence: "0.8900",
      externalId: "email-vendor-20241201",
      vendorId: dataGuard?.id ?? null,
      contentHash: "0010001000100010001000100010001000100010001000100010001000100010",
      metadata: { from: "incidents@dataguard.com", subject: "Service Disruption Notification - EU DC", receivedAt: "2024-12-01T14:30:00Z" },
    },
    {
      source: "email",
      content: "Anonymous tip: Potential insider threat activity observed in finance department file shares.",
      status: "pending" as const,
      classification: "operational",
      confidence: "0.6000",
      externalId: "email-tip-20241205",
      vendorId: null as string | null,
      contentHash: "0011001100110011001100110011001100110011001100110011001100110011",
      metadata: { from: "anonymous@protonmail.com", subject: "Security Concern Report", receivedAt: "2024-12-05T22:00:00Z" },
    },
  ];

  const insertedSignals = await db.insert(signalsTable).values(
    signalDefs.map((s) => ({
      tenantId,
      source: s.source,
      content: s.content,
      status: s.status,
      classification: s.classification ?? null,
      confidence: s.confidence,
      externalId: s.externalId,
      vendorId: s.vendorId,
      contentHash: s.contentHash,
      metadata: s.metadata,
    }))
  ).returning();

  console.log(`[Seed] Created ${insertedSignals.length} expanded signals`);

  return Object.fromEntries(
    insertedSignals
      .filter((s) => s.externalId)
      .map((s) => [s.externalId!, s.id])
  );
}

async function seedFindings(
  tenantId: string,
  signalIdMap: Record<string, string>,
  risks: { id: string }[],
  vendors: Vendor[]
): Promise<void> {
  const countResult = await db.execute(
    sql`SELECT count(*)::int AS cnt FROM findings WHERE tenant_id = ${tenantId}`
  );
  const existing = (countResult.rows[0] as { cnt: number }).cnt;
  if (existing > 0) {
    console.log("[Seed] Findings already seeded, skipping");
    return;
  }

  // Base risks by index:
  // 1 = Data Breach via Third-Party
  // 2 = Regulatory Non-Compliance Fine
  // 4 = Supply Chain Disruption
  // 7 = Cyber Ransomware Attack
  const dataBreachRisk = risks[1];
  const regulatoryRisk = risks[2];
  const supplyChainRisk = risks[4];
  const ransomwareRisk = risks[7];

  if (!dataBreachRisk || !regulatoryRisk || !supplyChainRisk || !ransomwareRisk) {
    console.log("[Seed] Required risks not found for findings, skipping");
    return;
  }

  // Base vendors: 0=CloudScale, 1=DataGuard Pro
  const cloudScale = vendors[0];
  const dataGuard = vendors[1];

  const findingDefs = [
    {
      title: "Critical RDP Exposure on CloudScale Infrastructure",
      description: "Shodan scan detected an open RDP port (3389) on CloudScale's internet-facing infrastructure. This creates a direct remote access attack vector that could be exploited for unauthorized access or ransomware deployment.",
      signalExternalId: "shodan-rdp-cloudscale",
      riskId: dataBreachRisk.id,
      vendorId: cloudScale?.id ?? null,
      status: "open" as const,
    },
    {
      title: "FortiOS RCE Vulnerability Requires Immediate Patching",
      description: "CVE-2024-21762 affects FortiOS SSL VPN with a CVSS score of 9.8. Active exploitation has been observed in the wild. All FortiOS 7.4.x deployments require immediate patching to 7.4.3 or later.",
      signalExternalId: "CVE-2024-21762",
      riskId: ransomwareRisk.id,
      vendorId: null as string | null,
      status: "investigating" as const,
    },
    {
      title: "Anomalous Data Exfiltration from Finance Server",
      description: "Microsoft Sentinel detected 2.4GB of outbound data transfer from the finance application server to an unrecognized external IP (45.33.32.156) during off-hours. This pattern is consistent with data exfiltration behavior and warrants immediate investigation.",
      signalExternalId: "sentinel-exfil-20241118",
      riskId: dataBreachRisk.id,
      vendorId: null as string | null,
      status: "open" as const,
    },
    {
      title: "APT28 Campaign Indicators Match Internal Network Traffic",
      description: "MISP threat intelligence for APT28 (Fancy Bear) campaign targeting financial services shows IP and domain indicators matching patterns observed in internal network logs. Further forensic analysis required to determine scope of potential compromise.",
      signalExternalId: "misp-45821",
      riskId: ransomwareRisk.id,
      vendorId: null as string | null,
      status: "investigating" as const,
    },
    {
      title: "Privileged Access Management Gaps (External Audit)",
      description: "External auditors from KPMG identified material gaps in privileged access management controls during Q4 review. Specific gaps include inadequate just-in-time (JIT) provisioning and missing quarterly access certification cycles for admin accounts.",
      signalExternalId: "email-audit-20241125",
      riskId: regulatoryRisk.id,
      vendorId: null as string | null,
      status: "resolved" as const,
    },
    {
      title: "DataGuard Service Disruption Impact Assessment",
      description: "DataGuard Pro reported a 4-hour service disruption affecting EU data centers on December 1st. This disruption impacted availability of security data processing services. SLA violation assessment pending confirmation from vendor.",
      signalExternalId: "email-vendor-20241201",
      riskId: supplyChainRisk.id,
      vendorId: dataGuard?.id ?? null,
      status: "open" as const,
    },
  ];

  // Each finding links to a signal via signalId (from signalIdMap) and a risk via riskId
  const findingValues = findingDefs.map((f) => ({
    tenantId,
    title: f.title,
    description: f.description,
    signalId: signalIdMap[f.signalExternalId] ?? null,
    riskId: f.riskId,
    vendorId: f.vendorId,
    status: f.status,
  }));

  const insertedFindings = await db.insert(findingsTable).values(findingValues).returning();

  console.log(`[Seed] Created ${insertedFindings.length} findings linked to signals and risks`);
}

// --------------------------------------------------------------------------
// Main seed entry point
// --------------------------------------------------------------------------

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

    const password = await hashPassword("Ballpen-Kiosk-0!");

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

    // ---------- Expanded data (Task 1 + Task 2) ----------

    // Task 1: Risks, treatments, KRIs, incidents, review cycles
    const expandedRisks = await seedExpandedRisks(tenant.id, adminUser, rmUser, roUser);
    await seedTreatments(tenant.id, adminUser, rmUser, roUser, risks, expandedRisks);
    await seedKRIs(tenant.id, risks, expandedRisks);
    await seedIncidents(tenant.id, adminUser, rmUser, roUser, risks, expandedRisks);
    await seedReviewCycles(tenant.id, adminUser, rmUser, roUser, risks);

    // Task 2: Expanded vendors, subprocessors, org deps, monitoring, appetite
    const expandedVendors = await seedExpandedVendors(tenant.id);
    await seedSubprocessors(tenant.id, vendors, expandedVendors);
    await seedOrgDependencies(tenant.id);
    await seedMonitoringConfigs(tenant.id);
    await seedRiskAppetiteConfigs(tenant.id);

    // Task 3 (Plan 18-02): Assessments, expanded signals, findings
    await seedAssessments(tenant.id, vendors, isoFramework.id);
    const signalIdMap = await seedExpandedSignals(tenant.id, vendors);
    await seedFindings(tenant.id, signalIdMap, risks, vendors);

    console.log(`[Seed] Done — Acme Corp demo dataset created. Login: any-user@acme.com / Ballpen-Kiosk-0!`);
  } catch (err) {
    console.error("[Seed] Failed:", err);
  }
}
