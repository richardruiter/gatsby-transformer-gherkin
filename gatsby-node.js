const gherkin = require("@cucumber/gherkin").default
const fs = require("fs")

function streamToParts(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on("data", chunk => chunks.push(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(chunks))
  })
}

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions
  const typeDefs = `
    type Gherkin implements Node {
      comments: [Comment]
      feature: Feature
      uri: String
    }
    type Comment {
      location: FileLocation
      text: String
    }
    type Feature {
      location: FileLocation
      tags: [Tag]
      language: String
      keyword: String
      name: String
      description: String
      children: [FeatureChild]
    }
    type FeatureChild {
      background: Background
      rule: Rule
      scenario: Scenario
    }
    type FileLocation {
      line: Int!
      column: Int!
    }
    type Tag {
      location: FileLocation
      id: ID!
      name: String!
    }
    type Background {
      location: FileLocation
      keyword: String
      name: String
      steps: [Step]
    }
    type Rule {
      location: FileLocation
      keyword: String
      name: String
      children: [FeatureChild]
    }
    type Scenario {
      id: ID!
      keyword: String
      name: String
      steps: [Step]
      examples: [Example]
    }
    type Step {
      id: ID!
      location: FileLocation
      keyword: String
      text: String
      dataTable: DataTable
      docString: DocString
    }
    type Example {
      id: ID!
      location: FileLocation
      keyword: String
      name: String
      tableHeader: Row
      tableBody: [Row]
    }
    type DataTable {
      location: FileLocation
      rows: [Row]
    }
    type Row {
      id: ID!
      location: FileLocation
      cells: [Cell]
    }
    type Cell {
      location: FileLocation
      value: String
    }
    type DocString {
      location: FileLocation
      content: String
      delimiter: String
    }
  `
  createTypes(typeDefs)
}

exports.onCreateNode = async ({
  node,
  actions,
  createNodeId,
  createContentDigest,
}) => {
  const { createNode, createParentChildLink } = actions
  // only look for nodes of .feature
  if (
    node.internal.description &&
    node.internal.description.indexOf(".feature") > -1
  ) {
    const stream = gherkin.fromPaths([node.absolutePath], {
      createReadStream: path =>
        fs.createReadStream(path, { encoding: "utf-8" }),
      includeGherkinDocument: true,
      includePickles: false,
      includeSource: false,
    })
    const parts = await streamToParts(stream)
    parts.forEach((part, i) => {
      if (part.gherkinDocument) {
        const gherkinId = createNodeId(`${node.id} [${i}] >>> GHERKIN`)
        const obj = JSON.parse(JSON.stringify(part.gherkinDocument))
        const gherkinNode = {
          ...obj,
          id: gherkinId,
          children: [],
          parent: node.id,
          internal: {
            contentDigest: createContentDigest(obj),
            type: "Gherkin",
          },
        }
        createNode(gherkinNode)
        createParentChildLink({ parent: node, child: gherkinNode })
      }
    })
  }
}
