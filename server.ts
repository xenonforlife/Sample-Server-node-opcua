// Copyright 2021 (c) Andreas Heine
//
// http://node-opcua.github.io/
// https://node-opcua.github.io/api_doc/

import { 
    OPCUAServer, 
    MessageSecurityMode, 
    SecurityPolicy,
    ServerState,
    coerceLocalizedText, 
    ServerCapabilities,
    OperationLimits,
    DataType,
    UAObject,
    UAVariable,
    UAObjectType,
} from "node-opcua" ;

const port = Number(process.env.ua_port) || 4840;
const ip = process.env.ua_ip || "0.0.0.0";

const server = new OPCUAServer({
    port: port,
    hostname: ip,
    maxAllowedSessionNumber: 100,
    maxConnectionsPerEndpoint: 100,
    resourcePath: "/UA",
    buildInfo : {
        productUri: "SampleServer-productUri",
        productName: "SampleServer-productName",
        manufacturerName: "SampleServer-manufacturerName",
        buildNumber: "v1.0.0",
        buildDate: new Date()
    },
    serverInfo: {
        applicationName: { 
            text: "SampleServer-applicationName", 
            locale: "en" 
        },
        applicationUri: "urn:SampleServer",
        productUri: "SampleServer-productUri"
    },
    serverCapabilities: new ServerCapabilities({
        maxBrowseContinuationPoints: 10,
        maxArrayLength: 1000,
        operationLimits: new OperationLimits({
            maxMonitoredItemsPerCall: 1000,
            maxNodesPerBrowse: 1000,
            maxNodesPerRead: 1000,
            maxNodesPerRegisterNodes: 1000,
            maxNodesPerTranslateBrowsePathsToNodeIds: 1000,
            maxNodesPerWrite: 1000,
        })
    }),
    allowAnonymous: true,
    securityModes: [
        MessageSecurityMode.None, 
    ],
    securityPolicies: [
        SecurityPolicy.None, 
    ],
    disableDiscovery: false,
    nodeset_filename: [
        "deps/Opc.Ua.NodeSet2.xml", 
        "deps/Opc.Ua.Di.NodeSet2.xml", 
        "deps/Opc.Ua.Machinery.NodeSet2.xml",
        "deps/Opc.Ua.SurfaceTechnology.NodeSet2.xml",
        "nodesets/CoatingLine/CoatingLine-example.xml",
        "nodesets/CoatingLine/Pretreatment.xml",
        "nodesets/CoatingLine/Materialsupplyroom.xml",
        "nodesets/CoatingLine/dosingsystem.xml",
        "nodesets/CoatingLine/ovenbooth.xml",
        "nodesets/CoatingLine/ConveyorGunsAxes.xml"
    ],
});

interface MachineIdentificationType extends UAObject {
    location: UAVariable;
    manufacturer: UAVariable;
    model: UAVariable;
    productInstanceUri: UAVariable;
    serialNumber: UAVariable;
    softwareRevision: UAVariable;
    yearOfConstruction: UAVariable;
}

const create_addressSpace = () => {
    const addressSpace = server.engine.addressSpace;

    // CoatinglineIdentification:
    const coatingLineIdentification = addressSpace?.findNode("ns=5;i=5003") as MachineIdentificationType;

    coatingLineIdentification.location.setValueFromSource({
        dataType: DataType.String,
        value: "Location",
    });
    coatingLineIdentification.manufacturer.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText("Manufacturer"),
    });
    coatingLineIdentification.model.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText("Model"),
    });
    coatingLineIdentification.productInstanceUri.setValueFromSource({
        dataType: DataType.String,
        value: "ProductInstanceUri",
    });
    coatingLineIdentification.serialNumber.setValueFromSource({
        dataType: DataType.String,
        value: "SerialNumber",
    });
    coatingLineIdentification.softwareRevision.setValueFromSource({
        dataType: DataType.String,
        value: "SoftwareRevision",
    });
    coatingLineIdentification.yearOfConstruction.setValueFromSource({
        dataType: DataType.UInt16,
        value: new Date().getFullYear(),
    });

    // Add a machine manually:
    const machineryIdx = addressSpace?.getNamespaceIndex("http://opcfoundation.org/UA/Machinery/");
    const machinesFolder = addressSpace?.findNode(`ns=${machineryIdx};i=1001`) as UAObject;
    const namespace = addressSpace?.registerNamespace("http://mynewmachinenamespace/UA");
    const myMachine = namespace?.addObject({
        browseName: "MyMachine",
        organizedBy: machinesFolder,
    })
    const machineryIdentificationType = addressSpace?.findNode(`ns=${machineryIdx};i=1012`) as UAObjectType;
    const myMachineIdentification = machineryIdentificationType?.instantiate({
        browseName: "Identification",
        organizedBy: myMachine,
        optionals: ["Model"], // array of string 
    })
    const manufacturer = myMachineIdentification?.getChildByName("Manufacturer") as UAVariable;
    manufacturer?.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText("Manufacturer"),
    });
    const machineComponentsType = addressSpace?.findNode(`ns=${machineryIdx};i=1006`) as UAObjectType;
    const myMachineComponents = machineComponentsType?.instantiate({
        browseName: "Components",
        organizedBy: myMachine,
    })
}

const init = () => {
    create_addressSpace();

    console.log(" starting... ");
    server.start();
    
    const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
    console.log(" server is ready on ", endpointUrl);
    console.log(" CTRL+C to stop ");

    process.on("SIGINT", () => {
        if (server.engine.serverStatus.state === ServerState.Shutdown) {
            console.log("Server shutdown already requested... shutdown will happen in ", server.engine.serverStatus.secondsTillShutdown, "second");
            return;
        }
        console.log(" Received server interruption from user ");
        console.log(" shutting down ...");
        const reason = coerceLocalizedText("Shutdown by administrator");
        if (reason != null) {
            server.engine.serverStatus.shutdownReason = reason;
        }
        server.shutdown(10000, () => {
        console.log(" shutting down completed ");
        console.log(" done ");
        process.exit(0);
        });
    });
}

(async () => {

    try {
        server.initialize(init);
    } catch (error) {
        console.log("error", error);
        process.exit(-1);
    }

})();
