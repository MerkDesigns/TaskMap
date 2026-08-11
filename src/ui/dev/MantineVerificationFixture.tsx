import { Button, Group, Menu, Modal, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import "./MantineVerificationFixture.css";

const workspaceOptions = [
  { value: "local", label: "Local workspace" },
  { value: "portable", label: "Portable workspace" },
];

export function MantineVerificationFixture() {
  const [modalOpened, { close: closeModal, open: openModal }] = useDisclosure(false);

  return (
    <main className="taskmap-mantine-fixture" data-taskmap-mantine-fixture="development-only">
      <Stack className="taskmap-mantine-fixture__content" gap="lg">
        <div>
          <Title order={1}>Mantine foundation</Title>
          <Text c="dimmed" size="sm">
            Development-only verification for standard controls and overlays.
          </Text>
        </div>

        <TextInput label="Canvas name" placeholder="Planning canvas" />
        <Select
          data={workspaceOptions}
          defaultValue="local"
          label="Workspace type"
          allowDeselect={false}
        />

        <Group>
          <Button>Primary action</Button>
          <Button variant="default" onClick={openModal}>
            Open modal
          </Button>
          <Menu
            position="bottom-start"
            transitionProps={{ duration: 0 }}
            hideDetached={false}
            withinPortal={false}
          >
            <Menu.Target>
              <Button variant="subtle">Open menu</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Canvas</Menu.Label>
              <Menu.Item>Duplicate</Menu.Item>
              <Menu.Item color="red">Delete</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="Mantine modal verification"
        transitionProps={{ duration: 0 }}
        centered
      >
        <Stack>
          <Text size="sm">Focus management, overlay behavior, and dark styling are active.</Text>
          <Button onClick={closeModal}>Close modal</Button>
        </Stack>
      </Modal>
    </main>
  );
}
