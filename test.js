function bgprouting(graph, start, end) {
  const distances = {};
  const previous = {};
  const nodes = new Set();
  let path = [];

  for (const node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    nodes.add(node);
  }

  distances[start] = 0;

  while (nodes.size > 0) {
    let smallestNode = null;
    for (const node of nodes) {
      if (smallestNode === null || distances[node] < distances[smallestNode]) {
        smallestNode = node;
      }
    }

    if (smallestNode === end) {
      while (previous[smallestNode]) {
        path.push(smallestNode);
        smallestNode = previous[smallestNode];
      }
      break;
    }

    nodes.delete(smallestNode);

    for (const neighbor in graph[smallestNode]) {
      const distance = distances[smallestNode] + graph[smallestNode][neighbor];

      if (distance < distances[neighbor]) {
        distances[neighbor] = distance;
        previous[neighbor] = smallestNode;
      }
    }
  }

  return path.concat([start]).reverse();
}

const graph = {
  "192.168.1.1:80": {
    "192.168.1.1:81": 1,
    "192.168.1.1:82": 5
  },
  "192.168.1.1:81": {
    "192.168.1.1:80": 1,
    "192.168.1.1:82": 2
  },
  "192.168.1.1:82": {
    "192.168.1.1:80": 5,
    "192.168.1.1:81": 2
  }
};

const start = "192.168.1.1:80";
const end = "192.168.1.1:82";

console.log(bgprouting(graph, start, end));